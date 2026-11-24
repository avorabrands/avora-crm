import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function PageHeader({
  title, description, actions, breadcrumbs, meta,
}: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; breadcrumbs?: Crumb[]; meta?: React.ReactNode }) {
  return (
    <div className="mb-5 space-y-3 sm:mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" />}
              {c.href ? <Link href={c.href} className="hover:text-foreground">{c.label}</Link> : <span className="text-foreground">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl break-words sm:text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="line-clamp-2 max-w-2xl text-sm text-muted-foreground sm:line-clamp-none">{description}</p>}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
      </div>
    </div>
  );
}
