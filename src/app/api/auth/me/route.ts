import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({
    userId: session.userId,
    email: session.email,
    role: session.role,
    permissions: Array.from(session.permissions),
  });
}
