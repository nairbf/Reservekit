import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireAuth } from "@/lib/auth";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string) {
  const fallback = `event-${Date.now()}`;
  const root = slugify(base) || fallback;
  let candidate = root;
  let i = 2;
  while (await prisma.event.findUnique({ where: { slug: candidate } })) {
    candidate = `${root}-${i}`;
    i += 1;
  }
  return candidate;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const session = await getSession();
  const today = new Date().toISOString().split("T")[0];

  if (slug) {
    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        tickets: {
          orderBy: { createdAt: "desc" },
          take: session ? 200 : 0,
        },
      },
    });
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!event.isActive && !session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ...event,
      remainingTickets: Math.max(0, event.maxTickets - event.soldTickets),
      soldOut: event.soldTickets >= event.maxTickets,
    });
  }

  const events = await prisma.event.findMany({
    where: session
      ? {}
      : { isActive: true, date: { gte: today } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(events.map(event => ({
    ...event,
    remainingTickets: Math.max(0, event.maxTickets - event.soldTickets),
    soldOut: event.soldTickets >= event.maxTickets,
  })));
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = String(body?.name || "").trim();
  const date = String(body?.date || "").trim();
  const startTime = String(body?.startTime || "").trim();
  const ticketPrice = Math.max(0, Math.trunc(Number(body?.ticketPrice || 0)));
  const maxTickets = Math.max(1, Math.trunc(Number(body?.maxTickets || 1)));

  if (!name || !date || !startTime || ticketPrice <= 0 || maxTickets <= 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const slug = await uniqueSlug(name);
  const created = await prisma.event.create({
    data: {
      name,
      description: body?.description ? String(body.description) : null,
      date,
      startTime,
      endTime: body?.endTime ? String(body.endTime) : null,
      ticketPrice,
      maxTickets,
      isActive: body?.isActive !== false,
      imageUrl: body?.imageUrl ? String(body.imageUrl) : null,
      slug,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
