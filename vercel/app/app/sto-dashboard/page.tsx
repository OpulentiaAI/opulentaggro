import { FrappeDeskPageEmbed } from "@/components/desk/FrappeDeskPageEmbed";
import { StoDashboardView } from "@/components/sto/StoDashboardView";
import { frappePageUrl } from "@/lib/frappe-desk";

export const metadata = {
  title: "Stock Transfer Orders",
};

export default function StoDashboardPage() {
  return (
    <FrappeDeskPageEmbed
      src={frappePageUrl("sto-dashboard")}
      title="Stock Transfer Orders"
      fallback={<StoDashboardView />}
    />
  );
}
