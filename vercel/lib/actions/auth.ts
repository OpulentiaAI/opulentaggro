"use server";

import { redirect } from "next/navigation";
import { clearSession, setSession } from "@/lib/auth/session";
import { getErpnextConfig } from "@/lib/erpnext/fetch-client";

export async function loginAction(formData: FormData): Promise<{ error?: string } | void> {
  const usr = String(formData.get("usr") ?? "").trim();
  const pwd = String(formData.get("pwd") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/app");

  if (!usr || !pwd) {
    return { error: "Email and password are required" };
  }

  const config = getErpnextConfig();
  if (!config) {
    return { error: "ERPNext URL is not configured" };
  }

  try {
    const response = await fetch(`${config.baseUrl}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ usr, pwd }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `Login failed: ${text.slice(0, 200)}` };
    }

    const setCookie = response.headers.get("set-cookie") ?? "";
    const sidMatch = setCookie.match(/sid=([^;]+)/);
    const sid = sidMatch?.[1];

    if (!sid) {
      return { error: "Login succeeded but no session cookie received" };
    }

    await setSession(sid, usr);
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Login failed" };
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : "/app");
}

export async function logoutAction(): Promise<void> {
  const config = getErpnextConfig();
  if (config) {
    try {
      await fetch(`${config.baseUrl}/api/method/logout`, { method: "POST", cache: "no-store" });
    } catch {
      /* ignore logout errors */
    }
  }
  await clearSession();
  redirect("/login");
}
