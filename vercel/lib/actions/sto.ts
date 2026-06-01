"use server";

import { revalidatePath } from "next/cache";
import { invokeStoAction } from "@/lib/sto/handlers";
import { doctypeFormPath } from "@/lib/doctype";

export async function runStoAction(
  action: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const result = await invokeStoAction(action, body);
  if (!result.ok) return { ok: false, error: result.error };

  const po = body.purchase_order as string | undefined;
  if (po) {
    revalidatePath("/app/sto-trace");
    revalidatePath(`/app/sto-trace?purchase_order=${po}`);
    revalidatePath("/app/sto-dashboard");
    revalidatePath(doctypeFormPath("Purchase Order", po));
  }

  return { ok: true, data: result.data };
}
