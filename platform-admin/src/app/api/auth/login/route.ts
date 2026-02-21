import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setAuthCookie, signSession, verifyPassword } from "@/lib/auth";
import { badRequest } from "@/lib/api";

export const runtime = "nodejs";

const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; windowStartedAt: number }>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function buildRateLimitKey(email: string, ip: string): string {
  return `${ip}:${email}`;
}

function pruneFailedAttempts(now: number) {
  for (const [key, entry] of failedAttempts.entries()) {
    if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}

function isRateLimited(key: string, now: number): boolean {
  const entry = failedAttempts.get(key);
  if (!entry) return false;
  if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    failedAttempts.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

function registerFailedAttempt(key: string, now: number) {
  const existing = failedAttempts.get(key);
  if (!existing || now - existing.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    failedAttempts.set(key, { count: 1, windowStartedAt: now });
    return;
  }
  failedAttempts.set(key, { ...existing, count: existing.count + 1 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) return badRequest("Email and password are required");

  const now = Date.now();
  const key = buildRateLimitKey(email, getClientIp(req));
  pruneFailedAttempts(now);

  if (isRateLimited(key, now)) {
    return NextResponse.json(
      { error: "Too many failed login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const user = await prisma.platformUser.findUnique({ where: { email } });
  if (!user) {
    registerFailedAttempt(key, now);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    registerFailedAttempt(key, now);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  failedAttempts.delete(key);

  const token = signSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
  setAuthCookie(response, token, req);
  return response;
}
