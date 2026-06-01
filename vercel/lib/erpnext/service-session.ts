/**
 * Service-account Frappe session for desk HTML proxy when no user is logged in.
 * Uses ERPNEXT_SERVICE_* or ERPNEXT_DEV_* credentials (server-only env vars).
 */

let cachedSid: string | null = null;
let loginPromise: Promise<string | null> | null = null;

function serviceCredentials(): { user: string; password: string } | null {
  const user =
    process.env.ERPNEXT_SERVICE_USER ||
    process.env.ERPNEXT_DEV_USER ||
    process.env.DEMO_ADMIN_USER;
  const password =
    process.env.ERPNEXT_SERVICE_PASSWORD ||
    process.env.ERPNEXT_DEV_PASSWORD ||
    process.env.FRAPPE_ADMIN_PASSWORD ||
    process.env.DEMO_ADMIN_PASSWORD;

  if (!user || !password) return null;
  return { user, password };
}

export function isServiceSessionConfigured(): boolean {
  return serviceCredentials() !== null;
}

export async function getServiceSessionSid(baseUrl: string): Promise<string | null> {
  if (cachedSid) return cachedSid;
  if (!serviceCredentials()) return null;

  if (!loginPromise) {
    loginPromise = loginServiceSession(baseUrl).finally(() => {
      loginPromise = null;
    });
  }

  cachedSid = await loginPromise;
  return cachedSid;
}

async function loginServiceSession(baseUrl: string): Promise<string | null> {
  const creds = serviceCredentials();
  if (!creds) return null;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usr: creds.user, pwd: creds.password }),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  for (const line of setCookies) {
    const match = line.match(/(?:^|;\s*)sid=([^;]+)/i);
    if (match?.[1]) return match[1];
  }

  const raw = response.headers.get("set-cookie");
  if (raw) {
    const match = raw.match(/sid=([^;]+)/i);
    if (match?.[1]) return match[1];
  }

  return null;
}
