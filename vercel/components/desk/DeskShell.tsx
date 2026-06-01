import { DeskSidebar } from "@/components/desk/Sidebar";
import { DeskTopBar } from "@/components/desk/TopBar";
import { getSession } from "@/lib/auth/session";

export async function DeskShell({
  children,
  wide = false,
  frappeEmbed = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
  frappeEmbed?: boolean;
}) {
  const session = await getSession();

  return (
    <div className={`desk-shell${frappeEmbed ? " desk-shell-embed" : ""}`}>
      <DeskTopBar user={session?.user} />
      <div className="desk-body">
        {!frappeEmbed ? <DeskSidebar /> : null}
        <main
          className={`desk-main${wide || frappeEmbed ? " desk-main-wide" : ""}${frappeEmbed ? " desk-main-embed" : ""}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
