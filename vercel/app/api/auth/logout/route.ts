import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth/session";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  return NextResponse.json({
    authenticated: Boolean(session?.sid),
    user: session?.user ?? null,
  });
}

export async function POST(): Promise<NextResponse> {
  await clearSession();
  const res = NextResponse.json({ message: "Logged out" });
  res.cookies.delete("erpnext_sid");
  res.cookies.delete("erpnext_user");
  return res;
}
