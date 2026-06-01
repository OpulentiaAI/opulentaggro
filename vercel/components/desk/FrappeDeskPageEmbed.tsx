import { FrappeDeskEmbedGate } from "@/components/desk/FrappeDeskEmbedGate";
import { isFrappeDeskProxyEnabled } from "@/lib/frappe-desk";

type FrappeDeskPageEmbedProps = {
  src: string;
  title: string;
  /** Rendered when Frappe desk proxy is disabled or desk boot fails. */
  fallback: React.ReactNode;
};

/** Full-bleed proxied Frappe desk page, or React fallback when proxy is off/unhealthy. */
export async function FrappeDeskPageEmbed({ src, title, fallback }: FrappeDeskPageEmbedProps) {
  if (!isFrappeDeskProxyEnabled()) {
    return <>{fallback}</>;
  }

  return <FrappeDeskEmbedGate src={src} title={title} fallback={fallback} />;
}
