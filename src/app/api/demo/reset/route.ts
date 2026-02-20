import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isDemoHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized.includes("demo.reservesit.com");
}

export async function POST(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (!isDemoHost(host)) {
    return NextResponse.json({ error: "Only available on demo" }, { status: 403 });
  }

  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    execSync("/home/reservesit/scripts/reset-demo.sh", {
      timeout: 30_000,
      stdio: "pipe",
    });
    return NextResponse.json({ success: true, message: "Demo data reset to defaults" });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : "Reset failed";
    return NextResponse.json({ error: "Reset failed", details }, { status: 500 });
  }
}
