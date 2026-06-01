import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth/session";
import { getErpnextConfig } from "@/lib/erpnext/fetch-client";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const config = getErpnextConfig();
  if (!config) {
    return NextResponse.json({ error: "ERPNext not configured" }, { status: 503 });
  }

  let body: { usr?: string; pwd?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { usr, pwd } = body;
  if (!usr || !pwd) {
    return NextResponse.json({ error: "usr and pwd required" }, { status: 400 });
  }

  try {
    const response = await fetch(`${config.baseUrl}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ usr, pwd }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.message ?? "Login failed" },
        { status: response.status }
      );
    }

    const setCookie = response.headers.get("set-cookie") ?? "";
    const sidMatch = setCookie.match(/sid=([^;]+)/);
    const sid = sidMatch?.[1];

    if (!sid) {
      return NextResponse.json({ error: "No session cookie from ERPNext" }, { status: 502 });
    }

    await setSession(sid, usr);

    const res = NextResponse.json({
      message: payload.message ?? "Logged in",
      user: usr,
    });
    res.cookies.set("erpnext_sid", sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    res.cookies.set("erpnext_user", usr, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
