import { DeskShell } from "@/components/desk/DeskShell";

export const metadata = {
  title: "Desk",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <DeskShell wide>{children}</DeskShell>;
}
