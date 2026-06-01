import { FrappeDeskEmbed } from "@/components/desk/FrappeDeskEmbed";
import { FrappeEmbedMode } from "@/components/desk/FrappeEmbedMode";
import { isFrappeDeskProxyEnabled } from "@/lib/frappe-desk";

type FrappeDeskPageEmbedProps = {
  src: string;
  title: string;
  /** Rendered when Frappe desk proxy is disabled (local fallback). */
  fallback: React.ReactNode;
};

/** Full-bleed proxied Frappe desk page, or React fallback when proxy is off. */
export function FrappeDeskPageEmbed({ src, title, fallback }: FrappeDeskPageEmbedProps) {
  if (!isFrappeDeskProxyEnabled()) {
    return <>{fallback}</>;
  }

  return (
    <>
      <FrappeEmbedMode fullBleed />
      <FrappeDeskEmbed src={src} title={title} />
    </>
  );
}
