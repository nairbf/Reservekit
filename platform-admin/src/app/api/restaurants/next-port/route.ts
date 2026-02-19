import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromRequest } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/api";
import { isAdminOrSuper } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  if (!isAdminOrSuper(session.role)) return forbidden();

  const result = await prisma.restaurant.aggregate({
    _max: { port: true },
  });

  const nextPort = Math.max((result._max.port || 3002) + 1, 3003);
  return NextResponse.json({ port: nextPort });
}
