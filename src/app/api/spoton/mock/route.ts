import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function GET() {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const orders = [
    {
      id: "MOCK-1001",
      orderTypeName: "Dine In",
      tableNumber: "12",
      totalAmount: "47.20",
      balanceDueAmount: "12.00",
      createdAt: isoMinutesAgo(42),
      closedAt: null,
      ownerInfo: { employeeName: "Mike" },
    },
    {
      id: "MOCK-1002",
      orderTypeName: "Dine-In",
      tableNumber: "7",
      totalAmount: "86.55",
      balanceDueAmount: "0.00",
      createdAt: isoMinutesAgo(95),
      closedAt: null,
      ownerInfo: { employeeName: "Ana" },
    },
    {
      id: "MOCK-1003",
      orderTypeName: "Dine In",
      tableNumber: "B1",
      totalAmount: "31.40",
      balanceDueAmount: "18.00",
      createdAt: isoMinutesAgo(18),
      closedAt: null,
      ownerInfo: { employeeName: "Leo" },
    },
    {
      id: "MOCK-2001",
      orderTypeName: "Dine In",
      tableNumber: "4",
      totalAmount: "64.10",
      balanceDueAmount: "0.00",
      createdAt: isoMinutesAgo(70),
      closedAt: isoMinutesAgo(6),
      ownerInfo: { employeeName: "Priya" },
    },
    {
      id: "MOCK-2002",
      orderTypeName: "Dine In",
      tableNumber: "15",
      totalAmount: "22.00",
      balanceDueAmount: "0.00",
      createdAt: isoMinutesAgo(30),
      closedAt: isoMinutesAgo(8),
      ownerInfo: { employeeName: "Sam" },
    },
    {
      id: "MOCK-TOGO-1",
      orderTypeName: "Takeout",
      tableNumber: "0",
      totalAmount: "19.50",
      balanceDueAmount: "0.00",
      createdAt: isoMinutesAgo(20),
      closedAt: null,
      ownerInfo: { employeeName: "Counter" },
    },
  ];

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    orders,
  });
}
