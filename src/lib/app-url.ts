import { headers } from "next/headers";

type HeaderReader = {
  get(name: string): string | null;
};

function normalizeUrl(url: string): string {
  return String(url || "").replace(/\/$/, "");
}

function buildUrlFromHost(host: string | null, forwardedProto?: string | null): string | null {
  if (!host) return null;
  const normalizedHost = host.split(",")[0]?.trim();
  if (!normalizedHost) return null;
  const protocol = forwardedProto?.split(",")[0]?.trim()
    || (normalizedHost.includes("localhost") ? "http" : "https");
  return `${protocol}://${normalizedHost}`;
}

export async function getAppUrl(): Promise<string> {
  try {
    const headerList = await headers();
    const derived = buildUrlFromHost(
      headerList.get("x-forwarded-host") || headerList.get("host"),
      headerList.get("x-forwarded-proto"),
    );
    if (derived) return normalizeUrl(derived);
  } catch {
    // Ignore and fall back.
  }
  return normalizeUrl(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001");
}

export function getAppUrlFromRequest(req: { headers: HeaderReader }): string {
  const derived = buildUrlFromHost(
    req.headers.get("x-forwarded-host") || req.headers.get("host"),
    req.headers.get("x-forwarded-proto"),
  );
  return normalizeUrl(derived || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001");
}

