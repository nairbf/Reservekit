interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

const store = new Map<string, RateLimitEntry>();

const globalScope = globalThis as unknown as { __reservekitRateLimitCleanup?: boolean };
if (!globalScope.__reservekitRateLimitCleanup) {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  };

  const timer = setInterval(cleanup, 5 * 60 * 1000);
  (timer as unknown as { unref?: () => void }).unref?.();
  globalScope.__reservekitRateLimitCleanup = true;
}

function applyRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + options.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.maxRequests - 1, resetAt };
  }

  entry.count += 1;
  if (entry.count > options.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: options.maxRequests - entry.count, resetAt: entry.resetAt };
}

export function rateLimit(namespace: string, ip: string, limit?: number, windowMs?: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};
export function rateLimit(key: string, options: RateLimitOptions): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};
export function rateLimit(
  namespaceOrKey: string,
  ipOrOptions: string | RateLimitOptions,
  limit = 10,
  windowMs = 60_000,
) {
  if (typeof ipOrOptions === "string") {
    return applyRateLimit(`${namespaceOrKey}:${ipOrOptions}`, { maxRequests: limit, windowMs });
  }
  return applyRateLimit(namespaceOrKey, ipOrOptions);
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkLoginRate(ip: string) {
  return applyRateLimit(`login:${ip}`, { windowMs: 15 * 60 * 1000, maxRequests: 10 });
}

export function checkReservationRate(ip: string) {
  return applyRateLimit(`reservation:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 20 });
}

export function checkPasswordResetRate(ip: string) {
  return applyRateLimit(`reset:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 });
}

export function checkApiRate(ip: string) {
  return applyRateLimit(`api:${ip}`, { windowMs: 60 * 1000, maxRequests: 120 });
}

export function checkWaitlistRate(ip: string) {
  return applyRateLimit(`waitlist:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 10 });
}

export function checkEmailTestRate(ip: string) {
  return applyRateLimit(`emailtest:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 10 });
}

export function tooManyRequests(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
    },
  });
}

export function getRateLimitResponse() {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}
