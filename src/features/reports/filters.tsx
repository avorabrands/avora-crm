"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Option } from "@/features/common/lookups";

export function ReportFilters({ from, to, clients, projects, staff }: { from: string; to: string; clients: Option[]; projects: Option[]; staff: Option[] }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (k: string, v: string) => { const n = new URLSearchParams(params.toString()); if (v) n.set(k, v); else n.delete(k); start(() => router.replace(`${pathname}?${n}`, { scroll: false })); };
  const sel = (k: string, label: string, opts: Option[]) => (
    <select className="field-select w-auto min-w-36" value={params.get(k) ?? ""} onChange={(e) => set(k, e.target.value)} aria-label={label}>
      <option value="">{label}: All</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">From <Input type="date" value={from} onChange={(e) => set("from", e.target.value)} className="w-auto" /></label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">To <Input type="date" value={to} onChange={(e) => set("to", e.target.value)} className="w-auto" /></label>
      {sel("client", "Client", clients)}{sel("project", "Project", projects)}{sel("employee", "Employee", staff)}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
