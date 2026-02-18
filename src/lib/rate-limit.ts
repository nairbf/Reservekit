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

export function rateLimit(key: string, options: RateLimitOptions) {
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

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkLoginRate(ip: string) {
  return rateLimit(`login:${ip}`, { windowMs: 15 * 60 * 1000, maxRequests: 10 });
}

export function checkReservationRate(ip: string) {
  return rateLimit(`reservation:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 20 });
}

export function checkPasswordResetRate(ip: string) {
  return rateLimit(`reset:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 });
}

export function checkApiRate(ip: string) {
  return rateLimit(`api:${ip}`, { windowMs: 60 * 1000, maxRequests: 120 });
}

export function checkWaitlistRate(ip: string) {
  return rateLimit(`waitlist:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 10 });
}

export function checkEmailTestRate(ip: string) {
  return rateLimit(`emailtest:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 10 });
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
