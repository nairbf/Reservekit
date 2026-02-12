import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
  } catch {
    return unauthorized();
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
