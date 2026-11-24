import { Logo } from "@/components/app/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
        <Logo inverted />
        <div className="max-w-md space-y-4">
          <p className="text-3xl font-semibold leading-tight">One Workspace.<br />Every Client.<br />Every Project.</p>
          <p className="text-sm text-sidebar-foreground">Leads, projects, creative deliverables, approvals, quotations, invoices and payments — the operating system of Avora Brands.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/70">© {new Date().getFullYear()} Avora Brands</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-primary/25 blur-3xl" />
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
