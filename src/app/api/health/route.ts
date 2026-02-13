import { NextResponse } from "next/server";
import { getLicenseInfo } from "@/lib/features";

export async function GET() {
  const license = await getLicenseInfo();
  return NextResponse.json({
    status: "ok",
    version: "1.0.0",
    uptime: process.uptime(),
    license: {
      key: license.key ? `****-${license.key.slice(-4)}` : null,
      valid: license.valid,
      plan: license.plan,
      status: license.status,
      lastCheck: license.lastCheck,
    },
  });
}
