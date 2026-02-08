import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = String(searchParams.get("code") || "").trim().toUpperCase();
  const phone = digitsOnly(searchParams.get("phone") || "");
  if (!code || phone.length < 4) {
    return NextResponse.json({ error: "code and phone are required" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({ where: { code } });
  if (!reservation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const incomingLast4 = phone.slice(-4);
  const storedLast4 = digitsOnly(reservation.guestPhone).slice(-4);
  if (!incomingLast4 || !storedLast4 || incomingLast4 !== storedLast4) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    guestName: reservation.guestName,
    date: reservation.date,
    time: reservation.time,
    partySize: reservation.partySize,
    status: reservation.status,
    code: reservation.code,
  });
}
