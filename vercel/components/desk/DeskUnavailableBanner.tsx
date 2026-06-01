import Link from "next/link";

type DeskUnavailableBannerProps = {
  reason?: string | null;
  showLogin?: boolean;
};

/** Shown when Frappe desk iframe is unavailable but ported React views may still work. */
export function DeskUnavailableBanner({
  reason,
  showLogin = true,
}: DeskUnavailableBannerProps) {
  const backendUrl =
    process.env.NEXT_PUBLIC_ERPNEXT_URL ?? process.env.ERPNEXT_URL ?? null;

  return (
    <div className="sto-fallback-banner desk-unavailable-banner">
      <div>
        <strong>Frappe desk view unavailable</strong>
        <p className="muted">
          {reason ??
            "The ERPNext desk could not load. Showing the ported list/form view instead."}
        </p>
      </div>
      <div className="desk-unavailable-actions">
        {showLogin ? (
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
        ) : null}
        {backendUrl ? (
          <a
            href={backendUrl}
            className="btn btn-ghost btn-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open ERPNext directly
          </a>
        ) : null}
      </div>
    </div>
  );
}
