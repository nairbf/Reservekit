import jwt from "jsonwebtoken";
import type { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE = "customer_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface CustomerSession {
  id: string;
  email: string;
  name: string;
}

interface CustomerToken {
  sub: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

const TEST_CUSTOMER = {
  id: "cust_reef_demo",
  email: "customer@reef.com",
  password: "customer123",
  name: "Reef Demo Customer",
};

let cachedSecret: string | null = null;

function getJwtSecret() {
  if (cachedSecret) return cachedSecret;
  const env = process.env.JWT_SECRET?.trim();
  if (env) {
    cachedSecret = env;
    return env;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }

  cachedSecret = "marketing-site-dev-secret";
  return cachedSecret;
}

export function getTestCustomer() {
  return TEST_CUSTOMER;
}

export function signSession(session: CustomerSession) {
  return jwt.sign(
    {
      sub: session.id,
      email: session.email,
      name: session.name,
    },
    getJwtSecret(),
    { expiresIn: SESSION_TTL_SECONDS },
  );
}

export function decodeSession(token: string): CustomerSession | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as CustomerToken;
    if (!payload?.sub || !payload?.email || !payload?.name) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): CustomerSession | null {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export function shouldUseSecureCookies(request?: NextRequest) {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;

  const proto = request?.headers.get("x-forwarded-proto")?.toLowerCase();
  if (proto) return proto === "https";

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
