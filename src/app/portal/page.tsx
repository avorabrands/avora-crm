import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Receipt, ThumbsUp, Wallet } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_STATUS } from "@/lib/constants";
import { effectiveInvoiceStatus, formatDate, formatINR, formatRelative, todayISO } from "@/lib/format";
import { firstName } from "@/lib/format";
import { Panel, StatCard } from "@/components/app/panel";
import { StatusBadge } from "@/components/app/status-badge";
import { INVOICE_STATUS } from "@/lib/constants";
import { ProgressBar } from "@/features/projects/components/projects-table";
import { portalDeliverables, portalMe } from "@/features/portal/queries";

export const metadata: Metadata = { title: "Client portal" };

export default async function PortalHome() {
  const s = await requireClient();
  const supabase = await createClient();
  const [me, { data: projects }, pending, { data: milestones }, { data: updates }, { data: invoices }, { data: payments }] = await Promise.all([
    portalMe(),
    supabase.from("projects").select("id, name, code, status, progress, due_date").not("status", "in", "(cancelled)").order("created_at", { ascending: false }),
    portalDeliverables({ pendingOnly: true }),
    supabase.from("project_milestones").select("id, title, due_date, status, project:projects(name)").neq("status", "completed").gte("due_date", todayISO()).order("due_date").limit(5),
    supabase.from("activity_logs").select("id, summary, created_at").eq("client_visible", true).order("created_at", { ascending: false }).limit(8),
    supabase.from("invoices").select("id, number, total, balance_due, due_date, status").in("status", ["unpaid", "partially_paid"]).order("due_date"),
    supabase.from("payments").select("id, receipt_number, amount, payment_date").order("payment_date", { ascending: false }).limit(5),
  ]);
  const active = (projects ?? []).filter((p) => !["completed", "cancelled"].includes(p.status));
  const outstanding = (invoices ?? []).reduce((a, i) => a + Number(i.balance_due), 0);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-sidebar p-6 text-white">
        <p className="text-sm text-sidebar-foreground">Welcome back,</p>
        <h1 className="text-2xl font-semibold">{firstName(s.fullName)} · {me?.company_name}</h1>
        <p className="mt-1 text-sm text-sidebar-foreground">Track your projects, review designs and manage billing with Avora Brands.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active projects" value={active.length} icon={FolderKanban} href="/portal/projects" />
        <StatCard label="Awaiting your approval" value={pending.length} icon={ThumbsUp} tone={pending.length ? "warning" : "default"} href="/portal/approvals" />
        <StatCard label="Pending invoices" value={(invoices ?? []).length} hint={formatINR(outstanding)} icon={Receipt} href="/portal/invoices" />
        <StatCard label="Payments made" value={formatINR((payments ?? []).reduce((a, p) => a + Number(p.amount), 0))} hint="Last 5" icon={Wallet} href="/portal/payments" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Project progress">
          {active.length === 0 ? <p className="text-sm text-muted-foreground">No active projects right now.</p> : (
            <ul className="space-y-4">{active.map((p) => (
              <li key={p.id}>
                <div className="flex items-center justify-between gap-2"><Link href={`/portal/projects/${p.id}`} className="font-medium hover:text-primary">{p.name}</Link><StatusBadge def={PROJECT_STATUS} value={p.status} /></div>
                <ProgressBar value={p.progress} className="mt-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">Expected delivery {formatDate(p.due_date)}</p>
              </li>
            ))}</ul>
          )}
        </Panel>
        <div className="space-y-6">
          {pending.length > 0 && (
            <Panel title="Waiting for your review" action={<Link href="/portal/approvals" className="text-xs text-primary hover:underline">Review all</Link>}>
              <ul className="space-y-2">{pending.slice(0, 5).map((d) => <li key={d.id} className="flex justify-between gap-2 text-sm"><span className="truncate">{d.name}</span><span className="shrink-0 text-xs text-muted-foreground">{d.project?.name}</span></li>)}</ul>
            </Panel>
          )}
          <Panel title="Upcoming submissions">
            {(milestones ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No upcoming milestones.</p> : (
              <ul className="space-y-2">{(milestones ?? []).map((m) => <li key={m.id} className="flex justify-between gap-2 text-sm"><span className="truncate">{m.title}<span className="block text-xs text-muted-foreground">{(m.project as unknown as { name: string })?.name}</span></span><span className="shrink-0 text-xs">{formatDate(m.due_date, "dd MMM")}</span></li>)}</ul>
            )}
          </Panel>
        </div>
        <Panel title="Recent updates">
          {(updates ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No updates yet.</p> : (
            <ul className="space-y-3">{(updates ?? []).map((u) => <li key={u.id} className="text-sm">{u.summary}<p className="text-xs text-muted-foreground">{formatRelative(u.created_at)}</p></li>)}</ul>
          )}
        </Panel>
        <Panel title="Pending invoices">
          {(invoices ?? []).length === 0 ? <p className="text-sm text-muted-foreground">You&apos;re all paid up. Thank you!</p> : (
            <ul className="space-y-3">{(invoices ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <div><Link href={`/portal/invoices/${i.id}`} className="text-sm font-medium hover:text-primary">{i.number}</Link><p className="text-xs text-muted-foreground">Due {formatDate(i.due_date)}</p></div>
                <div className="text-right"><p className="text-sm font-semibold tabular-nums">{formatINR(i.balance_due)}</p><StatusBadge def={INVOICE_STATUS} value={effectiveInvoiceStatus(i)} /></div>
              </li>
            ))}</ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
