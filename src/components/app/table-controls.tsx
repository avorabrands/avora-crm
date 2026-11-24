"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight, KanbanSquare, List, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { startNavigation } from "@/components/app/nav-feedback";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function useParamNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (changes: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    if (qs === params.toString()) return; // nothing changed, nothing to load
    startNavigation(qs ? `${pathname}?${qs}` : pathname);
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, set, pending, pathname };
}

export type FilterDef = { name: string; label: string; options: { value: string; label: string }[] };

export type SortDef = { value: string; label: string };

export function TableToolbar({ placeholder = "Search…", filters = [], sorts = [], children }: { placeholder?: string; filters?: FilterDef[]; sorts?: SortDef[]; children?: React.ReactNode }) {
  const { params, set, pending } = useParamNav();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [sheet, setSheet] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => set({ q: q || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeCount = filters.filter((f) => params.get(f.name)).length;
  const active = activeCount > 0 || !!params.get("q");
  const reset = () => { setQ(""); set(Object.fromEntries([["q", null], ...filters.map((f) => [f.name, null])])); };
  const sortValue = params.get("sort") ? `${params.get("sort")}:${params.get("dir") ?? "asc"}` : "";

  const filterSelect = (f: FilterDef, className: string) => (
    <select key={f.name} aria-label={f.label} className={cn("field-select", className)} value={params.get(f.name) ?? ""} onChange={(e) => set({ [f.name]: e.target.value || null })}>
      <option value="">{f.label}: All</option>
      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="flex items-center gap-2 border-b p-3 lg:flex-wrap">
      <div className="relative min-w-0 flex-1 lg:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-8" aria-label="Search" enterKeyHint="search" />
      </div>

      {(filters.length > 0 || sorts.length > 0) && (
        <Sheet open={sheet} onOpenChange={setSheet}>
          <SheetTrigger render={<Button variant="outline" className="relative shrink-0 lg:hidden" aria-label={`Filters${activeCount ? ` (${activeCount} on)` : ""}`} />}>
            <SlidersHorizontal /> Filters
            {activeCount > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">{activeCount}</span>}
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] gap-3 overflow-y-auto rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetTitle>Filter and sort</SheetTitle>
            {filters.map((f) => <label key={f.name} className="grid gap-1 text-xs text-muted-foreground">{f.label}{filterSelect(f, "text-foreground")}</label>)}
            {sorts.length > 0 && (
              <label className="grid gap-1 text-xs text-muted-foreground">Sort by
                <select className="field-select text-foreground" value={sortValue} onChange={(e) => { const [sort, dir] = e.target.value.split(":"); set({ sort: sort || null, dir: dir ?? null }); }}>
                  <option value="">Default</option>
                  {sorts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" onClick={reset} disabled={!active}>Reset</Button>
              <Button onClick={() => setSheet(false)}>Show results</Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        {filters.map((f) => filterSelect(f, "w-auto min-w-32 max-w-48"))}
        {active && <Button variant="ghost" size="sm" onClick={reset}><X /> Reset</Button>}
      </div>
      {pending && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      {children && <div className="flex items-center gap-2 lg:ml-auto">{children}</div>}
    </div>
  );
}

export function SortHeader({ column, children, className, defaultDir = "asc" }: { column: string; children: React.ReactNode; className?: string; defaultDir?: "asc" | "desc" }) {
  const { params, pathname } = useParamNav();
  const isActive = params.get("sort") === column;
  const dir = params.get("dir");
  const next = new URLSearchParams(params.toString());
  next.set("sort", column);
  next.set("dir", isActive ? (dir === "asc" ? "desc" : "asc") : defaultDir);
  next.delete("page");
  const Icon = !isActive ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link href={`${pathname}?${next.toString()}`} scroll={false} className={cn("inline-flex items-center gap-1 hover:text-foreground", isActive && "text-foreground", className)}>
      {children}
      <Icon className="size-3 opacity-60" />
    </Link>
  );
}

export function Pagination({ total, pageSize = 20 }: { total: number; pageSize?: number }) {
  const { params, pathname } = useParamNav();
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page"); else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
      <span>{total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} render={page > 1 ? <Link href={href(page - 1)} scroll={false} /> : undefined} aria-label="Previous page"><ChevronLeft /></Button>
        <span className="px-2 tabular-nums">{page} / {pages}</span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} render={page < pages ? <Link href={href(page + 1)} scroll={false} /> : undefined} aria-label="Next page"><ChevronRight /></Button>
      </div>
    </div>
  );
}

/** Segmented control for switching list/board/calendar views via ?view= */
const VIEW_ICONS = { list: List, board: KanbanSquare, calendar: CalendarDays } as const;

/** icon is a name (not a component) so server pages can pass it across the client boundary */
export function ViewSwitch({ views, defaultView }: { views: { value: string; label: string; icon?: keyof typeof VIEW_ICONS }[]; defaultView: string }) {
  const { params, set } = useParamNav();
  const current = params.get("view") ?? defaultView;
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5">
      {views.map((v) => (
        <button
          key={v.value}
          type="button"
          onClick={() => set({ view: v.value === defaultView ? null : v.value })}
          className={cn("inline-flex h-10 items-center gap-1.5 rounded-md px-3 md:h-7 md:px-2.5 text-xs font-medium text-muted-foreground transition-colors", current === v.value && "bg-accent text-accent-foreground")}
        >
          {v.icon && (() => { const Icon = VIEW_ICONS[v.icon]; return <Icon className="size-3.5" />; })()}
          {v.label}
        </button>
      ))}
    </div>
  );
}
