import { DeskUnavailableBanner } from "@/components/desk/DeskUnavailableBanner";
import { FrappeDeskEmbed } from "@/components/desk/FrappeDeskEmbed";
import { FrappeEmbedMode } from "@/components/desk/FrappeEmbedMode";
import { isFrappeDeskBootHealthy } from "@/lib/erpnext/desk-probe";
import { isFrappeDeskProxyEnabled } from "@/lib/frappe-desk";

type FrappeDeskEmbedGateProps = {
  src: string;
  title: string;
  fallback: React.ReactNode;
  unavailableReason?: string | null;
};

/** Prefer proxied Frappe desk when boot is healthy; otherwise render React fallback. */
export async function FrappeDeskEmbedGate({
  src,
  title,
  fallback,
  unavailableReason,
}: FrappeDeskEmbedGateProps) {
  const proxyEnabled = isFrappeDeskProxyEnabled();
  const deskHealthy = proxyEnabled ? await isFrappeDeskBootHealthy() : false;

  if (proxyEnabled && deskHealthy) {
    return (
      <>
        <FrappeEmbedMode fullBleed />
        <FrappeDeskEmbed src={src} title={title} />
      </>
    );
  }

  return (
    <>
      {proxyEnabled ? (
        <DeskUnavailableBanner
          reason={
            unavailableReason ??
            "ERPNext desk session boot failed on the backend. Using the ported view."
          }
        />
      ) : null}
      {fallback}
    </>
  );
}
