import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncLicenseToSettings, validateLicense } from "@/lib/license";

export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  const licenseKeySetting = await prisma.setting.findUnique({ where: { key: "license_key" } });
  if (!licenseKeySetting?.value) {
    return NextResponse.json({ error: "No license key configured" }, { status: 400 });
  }

  const licenseInfo = await validateLicense(licenseKeySetting.value);
  if (!licenseInfo) {
    return NextResponse.json({ error: "Could not reach license server", cached: true }, { status: 503 });
  }

  await syncLicenseToSettings(prisma, licenseInfo);

  if (!licenseInfo.valid) {
    return NextResponse.json({ valid: false, status: licenseInfo.status }, { status: 403 });
  }

  return NextResponse.json(licenseInfo);
}
