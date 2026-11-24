import Link from "next/link";
import { cn } from "@/lib/utils";

/** White rounded card used across the app. */
export function Panel({ title, description, action, children, className, bodyClassName }: {
  title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card text-card-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between flex-wrap gap-3 border-b px-4 py-3.5 sm:flex-nowrap sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName ?? "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default", href }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; tone?: "default" | "warning" | "danger" | "success"; href?: string;
}) {
  const toneCls = { default: "bg-accent text-accent-foreground", warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", danger: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" }[tone];
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && <div className={cn("hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex", toneCls)}><Icon className="size-4" /></div>}
    </div>
  );
  const cls = "block min-w-0 rounded-xl border bg-card p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
  return href ? <Link href={href} className={cn(cls, "transition-colors hover:border-primary/40")}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function DescriptionList({ items, columns = 2 }: { items: { label: string; value: React.ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
