import type { StoListResponse } from "@/lib/types/sto";
import { getStoList as fetchStoListCached } from "@/lib/sto/handlers";

/** @deprecated Use getStoList from lib/sto/handlers or callErpnextMethod directly */
export async function fetchStoList(limit = 20): Promise<StoListResponse> {
  return fetchStoListCached({ limit });
}

export { callErpnextMethod, getErpnextConfig, checkErpnextConnectivity } from "@/lib/erpnext/fetch-client";
