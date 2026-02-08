import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isModuleActive } from "@/lib/license";
import { getSpotOnRuntimeConfig } from "@/lib/spoton";

async function ensureLicensed() {
  const licensed = await isModuleActive("pos");
  if (!licensed) {
    return NextResponse.json({ error: "POS integration requires a license", licensed: false }, { status: 403 });
  }
  return null;
}

function pickLocationName(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();
  if (typeof obj.locationName === "string" && obj.locationName.trim()) return obj.locationName.trim();
  if (obj.location && typeof obj.location === "object") {
    const nested = obj.location as Record<string, unknown>;
    if (typeof nested.name === "string" && nested.name.trim()) return nested.name.trim();
  }
  return "";
}

export async function POST() {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const licenseError = await ensureLicensed();
  if (licenseError) return licenseError;

  const cfg = await getSpotOnRuntimeConfig();
  if (!cfg.apiKey || !cfg.locationId) {
    return NextResponse.json({ success: false, error: "SpotOn not configured" }, { status: 400 });
  }

  const url = `${cfg.baseUrl}/locations/${encodeURIComponent(cfg.locationId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "x-api-key": cfg.apiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    return NextResponse.json({
      success: false,
      error: body || `Connection failed (${response.status})`,
      environment: cfg.environment,
    }, { status: 400 });
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return NextResponse.json({
    success: true,
    locationName: pickLocationName(payload) || cfg.locationId,
    environment: cfg.environment,
  });
}
