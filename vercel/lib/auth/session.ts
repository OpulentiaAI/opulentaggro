import { cookies } from "next/headers";
import type { ErpnextConfig } from "@/lib/erpnext/fetch-client";
import { getErpnextConfig } from "@/lib/erpnext/fetch-client";

export const SESSION_COOKIE = "erpnext_sid";
export const USER_COOKIE = "erpnext_user";

export type SessionInfo = {
  sid: string;
  user?: string;
};

export async function getSession(): Promise<SessionInfo | null> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  return { sid, user: jar.get(USER_COOKIE)?.value };
}

export async function setSession(sid: string, user?: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  if (user) {
    jar.set(USER_COOKIE, user, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(USER_COOKIE);
}

/** Auth headers: user session cookie, else server token / dev session. */
export async function getErpnextAuthHeaders(
  config?: ErpnextConfig | null
): Promise<Record<string, string>> {
  const cfg = config ?? getErpnextConfig();
  const session = await getSession();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (session?.sid) {
    headers.Cookie = `sid=${session.sid}`;
    return headers;
  }

  if (cfg) {
    const { erpnextAuthHeaders: serverHeaders } = await import("@/lib/erpnext/fetch-client");
    return serverHeaders(cfg);
  }

  return headers;
}

export function hasServerAuth(): boolean {
  return Boolean(getErpnextConfig());
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  if (session?.sid) return true;
  return hasServerAuth();
}
