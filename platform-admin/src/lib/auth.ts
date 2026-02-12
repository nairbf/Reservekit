import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextRequest, NextResponse } from "next/server";
import type { PlatformRole } from "@/generated/prisma/client";

export const AUTH_COOKIE = "platform_token";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
}

interface SessionToken {
  sub: string;
  email: string;
  name: string;
  role: PlatformRole;
  iat: number;
  exp: number;
}

let cachedJwtSecret: string | null = null;

function getJwtSecret() {
  if (cachedJwtSecret) return cachedJwtSecret;

  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    cachedJwtSecret = configured;
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production runtime");
  }

  cachedJwtSecret = "dev-secret-change-me";
  return cachedJwtSecret;
}

export function signSession(user: SessionUser) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: SESSION_TTL_SECONDS },
  );
}

export function decodeSession(token: string): SessionUser | null {
  const secret = getJwtSecret();
  try {
    const payload = jwt.verify(token, secret) as SessionToken;
    if (!payload?.sub || !payload?.email || !payload?.role) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    // Keep auth failures non-fatal for request flow.
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): SessionUser | null {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export function requireSessionFromRequest(request: NextRequest): SessionUser {
  const session = getSessionFromRequest(request);
  if (!session) throw new Error("Unauthorized");
  return session;
}

export function shouldUseSecureCookies(request?: NextRequest) {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;

  const protoHeader = request?.headers.get("x-forwarded-proto")?.toLowerCase();
  if (protoHeader) return protoHeader === "https";

  const protocol = request?.nextUrl?.protocol?.toLowerCase();
  if (protocol) return protocol === "https:";

  return process.env.NODE_ENV === "production";
}

export function setAuthCookie(response: NextResponse, token: string, request?: NextRequest) {
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAuthCookie(response: NextResponse, request?: NextRequest) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
