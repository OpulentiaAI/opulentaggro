"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent } from "react";

export function TraceSearchForm({
  defaultPo,
  basePath = "/app/sto-trace",
}: {
  defaultPo?: string;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const po = new FormData(form).get("purchase_order");
    if (typeof po === "string" && po.trim()) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("purchase_order", po.trim());
      router.push(`${basePath}?${params.toString()}`);
    }
  }

  return (
    <form className="search-form" onSubmit={onSubmit}>
      <input
        name="purchase_order"
        type="text"
        placeholder="Purchase Order (e.g. PO-00001)"
        defaultValue={defaultPo ?? ""}
        aria-label="Purchase Order"
      />
      <button type="submit" className="btn btn-primary">
        Trace
      </button>
    </form>
  );
}
