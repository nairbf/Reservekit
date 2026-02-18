import { NextRequest, NextResponse } from "next/server";
import {
  setAuthCookie,
  signSession,
  validateCustomerLogin,
} from "@/lib/customer-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const customer = await validateCustomerLogin(email, password);
  if (!customer) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = signSession(customer);

  const response = NextResponse.json({
    user: customer,
  });

  setAuthCookie(response, token, req);
  return response;
}
