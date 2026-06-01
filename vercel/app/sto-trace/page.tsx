import { redirect } from "next/navigation";

export default async function LegacyStoTraceRedirect({
  searchParams,
}: {
  searchParams: Promise<{ purchase_order?: string }>;
}) {
  const params = await searchParams;
  const po = params.purchase_order?.trim();
  redirect(po ? `/app/sto-trace?purchase_order=${encodeURIComponent(po)}` : "/app/sto-trace");
}
