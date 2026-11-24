import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/constants";
import { NAV } from "@/components/shell/nav-config";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { NewMenu } from "@/components/shell/new-menu";
import { quickActionsFor } from "@/components/shell/quick-actions";
import { Logo } from "@/components/app/logo";
import { GlobalSearch } from "@/components/shell/global-search";
import { NotificationSlot } from "@/components/shell/notification-slot";
import { ThemeToggle, UserMenu } from "@/components/shell/user-menu";

export default async function InternalLayout({ children }: LayoutProps<"/">) {
  const session = await requireStaff();
  const sections = NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.capability || can(session.role, i.capability)) })).filter((s) => s.items.length);

  const actions = quickActionsFor(session.role);
  const all = sections.flatMap((s) => s.items);
  // managers/owners sell and deliver; team members work through projects and tasks
  const wanted = can(session.role, "leads.manage") ? ["/dashboard", "/leads", "/tasks"] : ["/dashboard", "/projects", "/tasks"];
  const tabs = wanted.flatMap((h) => all.filter((i) => i.href === h)).map((i) => (i.href === "/dashboard" ? { ...i, label: "Home", icon: "Home" } : i));
  const more = sections.map((s) => ({ ...s, items: s.items.filter((i) => !wanted.includes(i.href)) })).filter((s) => s.items.length);

  return (
    <div className="flex min-h-screen">
      <Sidebar sections={sections} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-1 border-b bg-background/85 px-4 lg:gap-3 backdrop-blur md:px-6">
          <Link href="/dashboard" className="min-w-0 flex-1 lg:hidden"><Logo /></Link>
          <div className="lg:flex-1"><GlobalSearch sections={sections} actions={actions} /></div>
          <NewMenu actions={actions} />
          <div className="hidden lg:block"><ThemeToggle /></div>
          <NotificationSlot userId={session.userId} />
          <UserMenu name={session.fullName} email={session.email} roleLabel={ROLES.label[session.role]} profileHref="/settings?tab=profile" />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-28 lg:p-8">{children}</main>
      </div>
      <BottomNav tabs={tabs} more={more} quickActions={actions} />
    </div>
  );
}
