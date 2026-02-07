import { NextRequest, NextResponse } from "next/server";
import { verifyLogin, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await verifyLogin(email, password);
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const token = createToken(user);
  const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  res.cookies.set("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/" });
  return res;
}
