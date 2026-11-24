import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CheckCircle2, CircleDollarSign, Clock, FileText, FolderKanban, Hourglass, PauseCircle, Target, ThumbsUp, Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { LEAD_STATUS, PROJECT_STATUS, PRIORITY } from "@/lib/constants";
import { daysUntil, formatDate, formatINR, formatRelative, todayISO } from "@/lib/format";
import { firstName } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { Panel, StatCard } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { UserAvatar } from "@/components/app/user-avatar";
import { ProgressBar } from "@/features/projects/components/projects-table";
import { dashboardData } from "@/features/dashboard/queries";
import { RevenueChart, StageBars } from "@/features/dashboard/charts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const s = await requireStaff();
  const sp = await searchParams;
  const finance = can(s.role, "finance.view");
  const sales = can(s.role, "leads.manage");
  const d = await dashboardData({ finance, sales, userId: s.userId, mine: s.role === "team_member" });
  const t = d.totals;
  const pipeline = LEAD_STATUS.values.map((v) => ({ stage: LEAD_STATUS.label[v], value: d.leadsByStatus.filter((l) => l.status === v).length }));
  const projectStatus = PROJECT_STATUS.values.map((v) => ({ stage: PROJECT_STATUS.label[v], value: d.projectsByStatus.filter((p) => p.status === v).length })).filter((x) => x.value > 0);
  const hour = new Date().getHours();

  return (
    <>
      {sp.denied && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">You don&apos;t have access to that page with your current role.</p>}
      <PageHeader title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${firstName(s.fullName)}`} description={s.role === "team_member" ? "Your projects, deadlines and tasks at a glance." : `Live overview of ${s.orgName} — every figure is calculated from current records.`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sales && <StatCard label="Total leads" value={t.leads} hint={`${t.openLeads} open`} icon={Target} href="/leads" />}
        <StatCard label="Clients" value={t.clients} icon={Building2} href="/clients" />
        <StatCard label="Active projects" value={t.activeProjects} hint={t.overdueProjects ? `${t.overdueProjects} past delivery date` : "On schedule"} icon={FolderKanban} tone={t.overdueProjects ? "warning" : "default"} href="/projects?status=active" />
        <StatCard label="Completed projects" value={t.completedProjects} icon={CheckCircle2} tone="success" href="/projects?status=completed" />
        {finance && <StatCard label="Revenue received" value={formatINR(t.revenue)} icon={CircleDollarSign} tone="success" href="/payments" />}
        {finance && <StatCard label="Outstanding payments" value={formatINR(t.outstanding)} hint={t.overdueAmount ? `${formatINR(t.overdueAmount)} overdue` : undefined} icon={Wallet} tone={t.overdueAmount ? "danger" : "warning"} href="/invoices?status=outstanding" />}
        {finance && <StatCard label="Pending quotations" value={t.pendingQuotations} hint={formatINR(t.pendingQuotationValue)} icon={FileText} href="/quotations?status=sent" />}
        <StatCard label="Projects on hold" value={t.onHoldProjects} icon={PauseCircle} href="/projects?status=on_hold" />
        <StatCard label="Overdue tasks" value={t.overdueTasks} icon={AlertTriangle} tone={t.overdueTasks ? "danger" : "default"} href="/tasks?overdue=1" />
        <StatCard label="Pending client approvals" value={t.pendingApprovals} icon={ThumbsUp} tone={t.pendingApprovals ? "warning" : "default"} />
        <StatCard label="Upcoming deadlines (14d)" value={d.upcomingProjects.length + d.upcomingTasks.length} icon={Clock} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {finance && <Panel title="Monthly revenue" description="Payments received, last 12 months" className="xl:col-span-2"><RevenueChart data={d.monthly} /></Panel>}
        <Panel title="Project status" description="All projects by current status" className={finance ? "" : "xl:col-span-2"}>
          {projectStatus.length ? <StageBars data={projectStatus} label="Projects by status" /> : <EmptyState icon={FolderKanban} title="No projects yet" />}
        </Panel>
        {sales && <Panel title="Sales pipeline" description="Leads in each stage" action={<Link href="/pipeline" className="text-xs text-primary hover:underline">Open pipeline</Link>}>
          {t.leads ? <StageBars data={pipeline} label="Leads by stage" /> : <EmptyState icon={Target} title="No leads yet" />}
        </Panel>}

        <Panel title="Upcoming deadlines" description="Projects due in the next 14 days" className={sales ? "xl:col-span-2" : ""}>
          {d.upcomingProjects.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due in the next two weeks.</p> : (
            <ul className="divide-y">{d.upcomingProjects.map((p) => {
              const days = daysUntil(p.due_date) ?? 0;
              return (
                <li key={p.id} className="flex items-center gap-4 py-2.5">
                  <div className="min-w-0 flex-1"><Link href={`/projects/${p.id}`} className="truncate font-medium hover:text-primary">{p.name}</Link><p className="text-xs text-muted-foreground">{p.client?.company_name}</p></div>
                  <ProgressBar value={p.progress} className="hidden w-32 sm:flex" />
                  <span className={cn("w-24 text-right text-xs", days < 0 ? "font-medium text-destructive" : days <= 3 ? "text-amber-600" : "text-muted-foreground")}>{days < 0 ? `${-days}d overdue` : days === 0 ? "Today" : `in ${days}d`}</span>
                </li>
              );
            })}</ul>
          )}
        </Panel>

        <Panel title={s.role === "team_member" ? "My upcoming tasks" : "Upcoming tasks"} action={<Link href="/tasks" className="text-xs text-primary hover:underline">All tasks</Link>}>
          {d.upcomingTasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks due soon.</p> : (
            <ul className="space-y-3">{d.upcomingTasks.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0"><Link href={`/tasks/${task.id}`} className="block truncate text-sm font-medium hover:text-primary">{task.title}</Link><p className="truncate text-xs text-muted-foreground">{task.project?.name}</p></div>
                <div className="shrink-0 text-right"><StatusBadge def={PRIORITY} value={task.priority} /><p className={cn("mt-0.5 text-xs", task.due_date < todayISO() ? "font-medium text-destructive" : "text-muted-foreground")}>{formatDate(task.due_date, "dd MMM")}</p></div>
              </li>
            ))}</ul>
          )}
        </Panel>

        {finance && <Panel title="Payment reminders" description="Open invoices by due date" action={<Link href="/invoices?status=outstanding" className="text-xs text-primary hover:underline">View all</Link>}>
          {d.reminders.length === 0 ? <p className="text-sm text-muted-foreground">No outstanding invoices.</p> : (
            <ul className="space-y-3">{d.reminders.map((i) => {
              const overdue = i.due_date < todayISO();
              return (
                <li key={i.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><Link href={`/invoices/${i.id}`} className="text-sm font-medium hover:text-primary">{i.number}</Link><p className="truncate text-xs text-muted-foreground">{i.client?.company_name}</p></div>
                  <div className="text-right"><p className="text-sm font-medium tabular-nums">{formatINR(i.balance_due)}</p><p className={cn("flex items-center justify-end gap-1 text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>{overdue && <AlertTriangle className="size-3" />}{overdue ? "Overdue · " : "Due "}{formatDate(i.due_date, "dd MMM")}</p></div>
                </li>
              );
            })}</ul>
          )}
        </Panel>}

        {sales && <Panel title="Recent enquiries" action={<Link href="/leads" className="text-xs text-primary hover:underline">All leads</Link>}>
          {d.recentLeads.length === 0 ? <p className="text-sm text-muted-foreground">No enquiries yet.</p> : (
            <ul className="space-y-3">{d.recentLeads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0"><Link href={`/leads/${l.id}`} className="block truncate text-sm font-medium hover:text-primary">{l.company_name}</Link><p className="truncate text-xs text-muted-foreground">{[l.contact_person, l.source].filter(Boolean).join(" · ")} · {formatRelative(l.created_at)}</p></div>
                <StatusBadge def={LEAD_STATUS} value={l.status} />
              </li>
            ))}</ul>
          )}
        </Panel>}

        <Panel title="Recent activity" className={finance && sales ? "" : "xl:col-span-2"}>
          {d.activity.length === 0 ? <EmptyState icon={Hourglass} title="No activity yet" /> : (
            <ul className="space-y-3">{d.activity.map((a) => (
              <li key={a.id} className="flex gap-3"><UserAvatar name={a.actor?.full_name ?? "System"} className="size-6 text-[10px]" /><div className="min-w-0"><p className="text-sm leading-snug">{a.summary}</p><p className="text-xs text-muted-foreground">{a.actor?.full_name ?? "System"} · {formatRelative(a.created_at)}</p></div></li>
            ))}</ul>
          )}
        </Panel>
      </div>
    </>
  );
}
