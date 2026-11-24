import Link from "next/link";
import { cn } from "@/lib/utils";

/** Server-rendered tabs driven by ?tab= so each tab loads only its own data. */
export function TabNav({ base, tabs, current }: { base: string; tabs: { id: string; label: string; count?: number | null }[]; current: string }) {
  return (
    <div className="mb-6 overflow-x-auto border-b">
      <nav className="flex min-w-max gap-1" aria-label="Tabs">
        {tabs.map((t, i) => {
          const active = t.id === current;
          return (
            <Link
              key={t.id}
              href={i === 0 ? base : `${base}${base.includes("?") ? "&" : "?"}tab=${t.id}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn("-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground", active && "border-primary font-medium text-foreground")}
            >
              {t.label}
              {t.count != null && <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{t.count}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function currentTab(sp: Record<string, string | string[] | undefined>, ids: string[]) {
  const t = typeof sp.tab === "string" ? sp.tab : undefined;
  return t && ids.includes(t) ? t : ids[0]!;
}
