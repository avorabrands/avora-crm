import Link from "next/link";
import { requireLead } from "@/lib/auth/session";
import { Logo } from "@/components/app/logo";
import { ThemeToggle, UserMenu } from "@/components/shell/user-menu";
import { leadPortalMe } from "@/features/portal/queries";

/** Quotations-only portal for leads. Converting the lead to a client moves the same login to the full client portal. */
export default async function LeadLayout({ children }: LayoutProps<"/lead">) {
  const s = await requireLead();
  const me = await leadPortalMe();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Link href="/lead"><Logo /></Link>
          <span className="hidden rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground sm:inline">Quotations · {me?.company_name}</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu name={s.fullName} email={s.email} roleLabel={me?.company_name ?? "Guest"} profileHref="/lead/profile" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 pb-16 md:p-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-muted-foreground">Avora Brands · One Workspace. Every Client. Every Project.</footer>
    </div>
  );
}
