"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import { LogOut, Menu, Moon, Plus, Sun } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LinkIcon } from "@/components/app/nav-feedback";
import { cn } from "@/lib/utils";
import { ICONS } from "./icons";
import type { NavItem, NavSection } from "./nav-config";
import type { QuickAction } from "./quick-actions";

const isActive = (path: string, href: string) => (href === "/portal" ? path === href : path === href || path.startsWith(href + "/"));
const tabCls = "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground";

function TabLink({ item }: { item: NavItem }) {
  const active = isActive(usePathname(), item.href);
  const Icon = ICONS[item.icon] ?? Menu;
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(tabCls, active && "font-medium text-primary")}>
      <LinkIcon className="size-5"><Icon className="size-5" /></LinkIcon>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function BottomSheet({ open, onOpenChange, trigger, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; trigger: React.ReactElement; title: string; children: React.ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger render={trigger} />
      <SheetContent side="bottom" className="max-h-[85dvh] gap-3 overflow-y-auto rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SheetTitle>{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** Thumb-reach navigation for phones and tablets: two tabs, quick add, one tab, everything else under More. */
export function BottomNav({ tabs, more, quickActions = [], portal = false }: { tabs: NavItem[]; more: NavSection[]; quickActions?: QuickAction[]; portal?: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const inMore = !tabs.some((t) => isActive(pathname, t.href)) && more.some((s) => s.items.some((i) => isActive(pathname, i.href)));

  const add = quickActions.length > 0 && (
    <BottomSheet open={addOpen} onOpenChange={setAddOpen} title="Create new" trigger={
      <button type="button" aria-label="Create new" className="flex flex-1 items-center justify-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30"><Plus className="size-6" /></span>
      </button>
    }>
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((a) => {
          const Icon = ICONS[a.icon] ?? Plus;
          return <Link key={a.href} href={a.href} onClick={() => setAddOpen(false)} className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 font-medium active:bg-accent"><Icon className="size-5 text-primary" /> {a.label}</Link>;
        })}
      </div>
    </BottomSheet>
  );

  return (
    <nav aria-label="Main" className={cn("fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden", portal ? "md:hidden" : "lg:hidden")}>
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-1">
        {tabs.slice(0, 2).map((t) => <TabLink key={t.href} item={t} />)}
        {add}
        {tabs.slice(2).map((t) => <TabLink key={t.href} item={t} />)}
        <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="Menu" trigger={
          <button type="button" className={cn(tabCls, inMore && "font-medium text-primary")}><Menu className="size-5" /><span>More</span></button>
        }>
          {more.map((s) => (
            <div key={s.label} className="space-y-1.5">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{s.label}</p>
              <div className="grid grid-cols-3 gap-2">
                {s.items.map((i) => {
                  const Icon = ICONS[i.icon] ?? Menu;
                  return <Link key={i.href} href={i.href} onClick={() => setMoreOpen(false)} className={cn("flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-2 text-center text-xs active:bg-accent", isActive(pathname, i.href) && "border-primary bg-accent text-accent-foreground")}><Icon className="size-5" />{i.label}</Link>;
                })}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm">
              <Sun className="hidden size-4 dark:block" /><Moon className="size-4 dark:hidden" /> {resolvedTheme === "dark" ? "Light" : "Dark"} mode
            </button>
            <button type="submit" form="avora-signout" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm text-destructive"><LogOut className="size-4" /> Sign out</button>
          </div>
        </BottomSheet>
      </div>
    </nav>
  );
}
