import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncLicenseToSettings, type LicenseInfo } from "@/lib/license";

export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  const platformAdminUrl = String(
    process.env.PLATFORM_ADMIN_URL || process.env.ADMIN_API_URL || "",
  ).trim();
  if (!platformAdminUrl) {
    return NextResponse.json(
      {
        error:
          "License validation is not configured. Missing PLATFORM_ADMIN_URL in environment.",
      },
      { status: 500 },
    );
  }

  const envLicenseKey = String(process.env.LICENSE_KEY || "").trim();
  const licenseKeySetting = await prisma.setting.findUnique({ where: { key: "license_key" } });
  const settingsLicenseKey = String(licenseKeySetting?.value || "").trim();
  const licenseKey = envLicenseKey || settingsLicenseKey;
  if (!licenseKey) {
    return NextResponse.json(
      {
        error:
          "No license key configured. Set LICENSE_KEY in env or license_key in settings.",
      },
      { status: 400 },
    );
  }

  if (envLicenseKey && envLicenseKey !== settingsLicenseKey) {
    await prisma.setting.upsert({
      where: { key: "license_key" },
      create: { key: "license_key", value: envLicenseKey },
      update: { value: envLicenseKey },
    });
  }

  let payload: unknown;
  let responseStatus = 503;
  try {
    const response = await fetch(`${platformAdminUrl}/api/license/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    responseStatus = response.status;
    payload = await response.json().catch(() => ({}));
  } catch {
    return NextResponse.json(
      { error: "Could not reach license server", cached: true },
      { status: 503 },
    );
  }

  if (responseStatus < 200 || responseStatus >= 300) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: string }).error || "License validation failed")
        : "License validation failed";
    return NextResponse.json({ error: errorMessage }, { status: responseStatus });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "License server returned an invalid response" },
      { status: 502 },
    );
  }

  const licenseInfo = payload as LicenseInfo;
  await syncLicenseToSettings(prisma, licenseInfo);

  if (!licenseInfo.valid) {
    return NextResponse.json({ valid: false, status: licenseInfo.status }, { status: 403 });
  }

  return NextResponse.json(licenseInfo);
}
