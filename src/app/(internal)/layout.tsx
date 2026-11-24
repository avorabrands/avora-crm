import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/constants";
import { NAV } from "@/components/shell/nav-config";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { GlobalSearch } from "@/components/shell/global-search";
import { NotificationSlot } from "@/components/shell/notification-slot";
import { ThemeToggle, UserMenu } from "@/components/shell/user-menu";

export default async function InternalLayout({ children }: LayoutProps<"/">) {
  const session = await requireStaff();
  const sections = NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.capability || can(session.role, i.capability)) })).filter((s) => s.items.length);

  return (
    <div className="flex min-h-screen">
      <Sidebar sections={sections} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
          <MobileNav sections={sections} />
          <div className="flex-1"><GlobalSearch /></div>
          <ThemeToggle />
          <NotificationSlot userId={session.userId} />
          <UserMenu name={session.fullName} email={session.email} roleLabel={ROLES.label[session.role]} profileHref="/settings?tab=profile" />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
