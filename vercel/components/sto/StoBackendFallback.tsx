"use client";

import { useEffect, useState } from "react";
import { FrappeDeskEmbed } from "@/components/desk/FrappeDeskEmbed";
import { FrappeEmbedMode } from "@/components/desk/FrappeEmbedMode";
import { frappePageUrl } from "@/lib/frappe-desk-urls";

type StoBackendFallbackProps = {
  page: "sto-dashboard" | "sto-trace";
  title: string;
  query?: string;
  error?: string | null;
  children: React.ReactNode;
};

/** Ported React view by default; optional Frappe iframe when API is unreachable. */
export function StoBackendFallback({
  page,
  title,
  query,
  error,
  children,
}: StoBackendFallbackProps) {
  const [useIframe, setUseIframe] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(false);

  useEffect(() => {
    void fetch("/api/health")
      .then((res) => res.json())
      .then((health) => {
        setProxyEnabled(Boolean(health?.components?.erpnext?.configured));
      })
      .catch(() => setProxyEnabled(false));
  }, []);

  if (useIframe && proxyEnabled) {
    const src = query
      ? `${frappePageUrl(page)}?${query}`
      : frappePageUrl(page);
    return (
      <>
        <FrappeEmbedMode fullBleed />
        <div className="sto-fallback-toolbar">
          <span className="muted">Showing Frappe desk (backend iframe fallback)</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUseIframe(false)}>
            Back to ported view
          </button>
        </div>
        <FrappeDeskEmbed src={src} title={title} />
      </>
    );
  }

  return (
    <>
      {error && proxyEnabled ? (
        <div className="sto-fallback-banner">
          <div>
            <strong>ERPNext API unreachable</strong>
            <p className="muted">{error}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUseIframe(true)}>
            Open Frappe desk view
          </button>
        </div>
      ) : null}
      {children}
    </>
  );
}
