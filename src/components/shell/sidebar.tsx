"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Building2, CheckSquare, ChevronsLeft, ChevronsRight, FileSignature, FileText, Files, FolderKanban,
  KanbanSquare, LayoutDashboard, Receipt, Settings, Target, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NavSection } from "./nav-config";

const ICONS: Record<string, LucideIcon> = { BarChart3, Building2, CheckSquare, FileSignature, FileText, Files, FolderKanban, KanbanSquare, LayoutDashboard, Receipt, Settings, Target, Users, Wallet };

export function NavLinks({ sections, collapsed = false, onNavigate }: { sections: NavSection[]; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((s) => (
        <div key={s.label} className="space-y-1">
          {!collapsed && <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">{s.label}</p>}
          {s.items.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white",
                  active && "bg-sidebar-accent font-medium text-white shadow-[inset_2px_0_0_var(--sidebar-primary)]",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : link;
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ sections }: { sections: NavSection[] }) {
  const [collapsed, setCollapsed] = useState(false);
  // read persisted preference after hydration (localStorage is unavailable during SSR)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCollapsed(localStorage.getItem("avora.sidebar") === "collapsed"); }, []);
  const toggle = () => setCollapsed((c) => { localStorage.setItem("avora.sidebar", c ? "open" : "collapsed"); return !c; });

  return (
    <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex", collapsed ? "w-[68px]" : "w-60")}>
      <div className={cn("flex h-16 items-center border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard"><Logo inverted compact={collapsed} /></Link>
      </div>
      <NavLinks sections={sections} collapsed={collapsed} />
      <button onClick={toggle} className="flex h-11 items-center justify-center gap-2 border-t border-sidebar-border text-xs text-sidebar-foreground hover:text-white" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
      </button>
    </aside>
  );
}
