/**
 * Same-origin Frappe desk reverse proxy with session cookie forwarding.
 * Rewrites absolute paths in HTML/JS/CSS so assets and API calls stay under /erpnext.
 */

import { getErpnextAuthHeaders, getSession } from "@/lib/auth/session";
import { getErpnextConfig } from "@/lib/erpnext/fetch-client";
import { getDevSessionSid } from "@/lib/erpnext/dev-auth";
import { getServiceSessionSid } from "@/lib/erpnext/service-session";

const PROXY_PREFIX = "/erpnext";

export async function getFrappeDeskProxyCookie(): Promise<string | null> {
  const session = await getSession();
  if (session?.sid) return `sid=${session.sid}`;

  const config = getErpnextConfig();
  if (!config) return null;

  if (config.authMode === "dev_session") {
    const sid = await getDevSessionSid(config.baseUrl);
    return `sid=${sid}`;
  }

  const serviceSid = await getServiceSessionSid(config.baseUrl);
  if (serviceSid) return `sid=${serviceSid}`;

  return null;
}

export async function proxyFrappeDeskRequest(
  request: Request,
  pathSegments: string[]
): Promise<Response> {
  const config = getErpnextConfig();
  if (!config) {
    return new Response("ERPNext not configured", { status: 503 });
  }

  const path = pathSegments.length ? pathSegments.join("/") : "";
  const incoming = new URL(request.url);
  const target = new URL(`/${path}${incoming.search}`, config.baseUrl);

  const headers = new Headers();
  const skipHeaders = new Set([
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
    "accept-encoding",
  ]);
  request.headers.forEach((value, key) => {
    if (!skipHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const cookie = await getFrappeDeskProxyCookie();
  if (cookie) {
    const existing = headers.get("cookie");
    headers.set("cookie", existing ? `${existing}; ${cookie}` : cookie);
  } else {
    const authHeaders = await getErpnextAuthHeaders(config);
    if (authHeaders.Cookie) headers.set("cookie", authHeaders.Cookie);
    if (authHeaders.Authorization) headers.set("authorization", authHeaders.Authorization);
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const upstream = await fetch(target.toString(), {
    method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  return buildProxyResponse(upstream);
}

async function buildProxyResponse(upstream: Response): Promise<Response> {
  const headers = new Headers();
  const skipResponseHeaders = new Set([
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
  ]);

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (skipResponseHeaders.has(lower)) return;
    if (lower === "location") {
      headers.set(key, rewriteLocation(value));
      return;
    }
    headers.set(key, value);
  });

  appendRewrittenSetCookies(upstream, headers);

  const contentType = upstream.headers.get("content-type") ?? "";
  const shouldRewrite =
    contentType.includes("text/html") ||
    contentType.includes("javascript") ||
    contentType.includes("text/css") ||
    contentType.includes("application/json");

  if (!shouldRewrite) {
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  const text = await upstream.text();
  const rewritten = rewriteBodyPaths(text);

  headers.delete("content-length");
  return new Response(rewritten, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function appendRewrittenSetCookies(upstream: Response, headers: Headers): void {
  const rawLines =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];

  const fallback = upstream.headers.get("set-cookie");
  const lines = rawLines.length ? rawLines : fallback ? [fallback] : [];

  for (const line of lines) {
    const rewritten = line.replace(/;\s*Domain=[^;]*/gi, "").replace(/;\s*Secure/gi, "");
    headers.append("set-cookie", rewritten);
  }
}

function rewriteLocation(location: string): string {
  const config = getErpnextConfig();
  if (!config) return location;
  const base = config.baseUrl.replace(/\/$/, "");
  if (location.startsWith(base)) {
    return `${PROXY_PREFIX}${location.slice(base.length)}`;
  }
  if (location.startsWith("/")) {
    return `${PROXY_PREFIX}${location}`;
  }
  return location;
}

/** Prefix root-absolute Frappe paths so iframe stays same-origin under /erpnext. */
function rewriteBodyPaths(body: string): string {
  if (body.includes(PROXY_PREFIX)) {
    /* avoid double-prefix on re-processing */
  }

  const prefixes = [
    "assets",
    "files",
    "api",
    "app",
    "private",
    "socket.io",
    "login",
    "logout",
    "desk",
  ];
  let out = body;

  for (const segment of prefixes) {
    const re = new RegExp(
      `(?<!${PROXY_PREFIX.replace("/", "\\/")})\\/(?:${segment})(?=/|"|'|\\?|\\s|$)`,
      "g"
    );
    out = out.replace(re, `${PROXY_PREFIX}/${segment}`);
  }

  const base = getErpnextConfig()?.baseUrl.replace(/\/$/, "");
  if (base) {
    out = out.replaceAll(base, "");
  }

  return out;
}
