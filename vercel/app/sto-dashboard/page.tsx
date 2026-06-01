import { redirect } from "next/navigation";

export default function LegacyStoDashboardRedirect() {
  redirect("/app/sto-dashboard");
}
