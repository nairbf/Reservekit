import { NextRequest, NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdminOrSuper } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }
  if (!isAdminOrSuper(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = String(searchParams.get("search") || "").trim();
  const plan = String(searchParams.get("plan") || "").trim();
  const status = String(searchParams.get("status") || "").trim();

  const rows = await prisma.restaurant.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { slug: { contains: search } },
              { licenseKey: { contains: search } },
            ],
          }
        : {}),
      ...(plan ? { plan: plan as never } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      licenseKey: true,
      plan: true,
      status: true,
      licenseActivatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(rows);
}
