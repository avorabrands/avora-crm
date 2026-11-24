import Link from "next/link";
import { requireClient } from "@/lib/auth/session";
import { Logo } from "@/components/app/logo";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ThemeToggle, UserMenu } from "@/components/shell/user-menu";
import { getNotifications } from "@/features/notifications/queries";
import { portalMe } from "@/features/portal/queries";
import { PortalNav } from "./portal-nav";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const s = await requireClient();
  const [me, notifications] = await Promise.all([portalMe(), getNotifications(s.userId)]);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/portal"><Logo /></Link>
          <span className="hidden rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground sm:inline">Client portal · {me?.company_name}</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell items={notifications.items} unread={notifications.unread} portal />
            <UserMenu name={s.fullName} email={s.email} roleLabel={me?.company_name ?? "Client"} profileHref="/portal/profile" />
          </div>
        </div>
        <PortalNav />
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground">Avora Brands · One Workspace. Every Client. Every Project.</footer>
    </div>
  );
}
