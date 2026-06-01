/** Frappe desk embed via same-origin /erpnext proxy (route handler + session forwarding). */

import { hasServerAuth } from "@/lib/auth/session";
import { isNoAuthModeEnabled } from "@/lib/erpnext/dev-auth";

export {
  frappeDeskUrl,
  frappeFormUrl,
  frappeListUrl,
  frappeNewFormUrl,
  frappePageUrl,
  frappeWorkspaceUrl,
} from "@/lib/frappe-desk-urls";

export function isFrappeDeskProxyEnabled(): boolean {
  if (process.env.FRAPPE_DESK_PROXY === "0") return false;
  if (process.env.NEXT_PUBLIC_FRAPPE_DESK_PROXY === "0") return false;
  const backendUrl = process.env.ERPNEXT_URL ?? process.env.NEXT_PUBLIC_ERPNEXT_URL;
  if (!backendUrl) return false;
  if (process.env.FRAPPE_DESK_PROXY === "1") return true;
  if (process.env.NEXT_PUBLIC_FRAPPE_DESK_PROXY === "1") return true;
  if (isNoAuthModeEnabled()) return true;
  if (hasServerAuth()) return true;
  return true;
}
