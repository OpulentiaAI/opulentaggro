/** Localhost dev session login (ERPNEXT_NO_AUTH=1). Never use against remote URLs. */

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function isNoAuthModeEnabled(): boolean {
  const flag =
    process.env.ERPNEXT_NO_AUTH === "1" ||
    process.env.ERPNEXT_NO_AUTH === "true" ||
    process.env.MCP_NO_AUTH === "1" ||
    process.env.MCP_NO_AUTH === "true";
  if (!flag) return false;
  const baseUrl = process.env.ERPNEXT_URL || "";
  if (!baseUrl) {
    throw new Error("ERPNEXT_NO_AUTH requires ERPNEXT_URL");
  }
  if (!isLocalhostUrl(baseUrl)) {
    throw new Error("ERPNEXT_NO_AUTH is only allowed for localhost ERPNext URLs");
  }
  return true;
}

function devCredentials(): { user: string; password: string } {
  return {
    user: process.env.ERPNEXT_DEV_USER || "Administrator",
    password:
      process.env.ERPNEXT_DEV_PASSWORD ||
      process.env.FRAPPE_ADMIN_PASSWORD ||
      process.env.DEMO_ADMIN_PASSWORD ||
      "admin",
  };
}

let cachedSid: string | null = null;
let loginPromise: Promise<string> | null = null;

export async function getDevSessionSid(baseUrl: string): Promise<string> {
  if (cachedSid) return cachedSid;
  if (!loginPromise) {
    loginPromise = loginDevSession(baseUrl).finally(() => {
      loginPromise = null;
    });
  }
  cachedSid = await loginPromise;
  return cachedSid;
}

async function loginDevSession(baseUrl: string): Promise<string> {
  const { user, password } = devCredentials();
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usr: user, pwd: password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dev session login failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const line of setCookie) {
    const match = line.match(/(?:^|;\s*)sid=([^;]+)/i);
    if (match?.[1]) return match[1];
  }

  const raw = response.headers.get("set-cookie");
  if (raw) {
    const match = raw.match(/sid=([^;]+)/i);
    if (match?.[1]) return match[1];
  }

  const payload = await response.json().catch(() => ({}));
  const message = (payload as { message?: unknown }).message;
  if (message === "Logged In" || message === "No App") {
    throw new Error("Login succeeded but no sid cookie returned");
  }
  if (message && typeof message === "object" && "full_name" in (message as object)) {
    throw new Error("Login succeeded but no sid cookie returned");
  }

  throw new Error(`Dev session login failed for ${user}`);
}
