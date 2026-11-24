import Link from "next/link";
import { requireClient } from "@/lib/auth/session";
import { Logo } from "@/components/app/logo";
import { NotificationSlot } from "@/components/shell/notification-slot";
import { ThemeToggle, UserMenu } from "@/components/shell/user-menu";
import { portalMe } from "@/features/portal/queries";
import { BottomNav } from "@/components/shell/bottom-nav";
import { PortalNav } from "./portal-nav";

const PORTAL_TABS = [
  { href: "/portal", label: "Home", icon: "Home" },
  { href: "/portal/projects", label: "Projects", icon: "FolderKanban" },
  { href: "/portal/approvals", label: "Approvals", icon: "ThumbsUp" },
  { href: "/portal/invoices", label: "Invoices", icon: "Receipt" },
];
const PORTAL_MORE = [
  { label: "Your work", items: [{ href: "/portal/deliverables", label: "Deliverables", icon: "Layers" }, { href: "/portal/files", label: "Files", icon: "Files" }] },
  { label: "Billing & account", items: [{ href: "/portal/quotations", label: "Quotations", icon: "FileText" }, { href: "/portal/payments", label: "Payments", icon: "Wallet" }, { href: "/portal/profile", label: "Profile", icon: "UserRound" }] },
];

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const s = await requireClient();
  const me = await portalMe();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/portal"><Logo /></Link>
          <span className="hidden rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground sm:inline">Client portal · {me?.company_name}</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationSlot userId={s.userId} portal />
            <UserMenu name={s.fullName} email={s.email} roleLabel={me?.company_name ?? "Client"} profileHref="/portal/profile" />
          </div>
        </div>
        <div className="hidden md:block"><PortalNav /></div>
      </header>
      <main className="mx-auto max-w-6xl p-4 pb-28 md:p-6">{children}</main>
      <BottomNav portal tabs={PORTAL_TABS} more={PORTAL_MORE} />
      <footer className="mx-auto hidden max-w-6xl md:block px-4 py-8 text-center text-xs text-muted-foreground">Avora Brands · One Workspace. Every Client. Every Project.</footer>
    </div>
  );
}
