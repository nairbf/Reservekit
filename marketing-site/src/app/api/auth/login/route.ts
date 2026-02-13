import { NextRequest, NextResponse } from "next/server";
import {
  getTestCustomer,
  setAuthCookie,
  signSession,
} from "@/lib/customer-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  const customer = getTestCustomer();
  if (email !== customer.email || password !== customer.password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = signSession({
    id: customer.id,
    email: customer.email,
    name: customer.name,
  });

  const response = NextResponse.json({
    user: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
    },
  });

  setAuthCookie(response, token, req);
  return response;
}
