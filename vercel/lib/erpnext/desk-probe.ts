import { cache } from "react";
import { getFrappeDeskProxyCookie } from "@/lib/frappe-desk-proxy";
import { getErpnextConfig } from "@/lib/erpnext/fetch-client";
import { isFrappeDeskProxyEnabled } from "@/lib/frappe-desk";

const DESK_BOOT_FAILURE_MARKERS = [
  "Uncaught Server Exception",
  "SessionBootFailed",
  "There was an error building this page",
  'data-path="error"',
];

/** True when proxied Frappe desk can boot (session + upstream HTML healthy). */
export const isFrappeDeskBootHealthy = cache(async (): Promise<boolean> => {
  if (!isFrappeDeskProxyEnabled()) return false;

  const config = getErpnextConfig();
  if (!config) return false;

  const cookie = await getFrappeDeskProxyCookie();
  if (!cookie) return false;

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/app/home`, {
      headers: { Cookie: cookie, Accept: "text/html" },
      redirect: "manual",
      cache: "no-store",
    });

    if (response.status >= 500) return false;

    const text = await response.text();
    if (DESK_BOOT_FAILURE_MARKERS.some((marker) => text.includes(marker))) {
      return false;
    }

    if (text.includes('frappe-session-status="logged-out"') && text.includes('data-path="login"')) {
      return false;
    }

    return response.ok || response.status === 302;
  } catch {
    return false;
  }
});
