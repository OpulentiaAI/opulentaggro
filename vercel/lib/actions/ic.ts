"use server";

import { revalidatePath } from "next/cache";
import { invokeIcAction } from "@/lib/ic/handlers";

export async function runIcAction(
  action: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const result = await invokeIcAction(action, body);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/app/intercompany/billing");
  revalidatePath("/app/intercompany");

  return { ok: true, data: result.data };
}
