import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CheckSquare, FileText, Layers, Pencil, Plus, Receipt, Trash2, Users, Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY, PROJECT_CATEGORY, PROJECT_STATUS } from "@/lib/constants";
import { daysUntil, formatDate, formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/page-header";
import { DescriptionList, Panel, StatCard } from "@/components/app/panel";
import { Pill, StatusBadge } from "@/components/app/status-badge";
import { StatusSelect } from "@/components/app/status-select";
import { PersonCell } from "@/components/app/user-avatar";
import { EmptyState } from "@/components/app/empty-state";
import { ActionForm, Field, FormSheet, SubmitButton } from "@/components/app/form";
import { ConfirmAction } from "@/components/app/confirm";
import { TabNav, currentTab } from "@/components/app/tab-nav";
import { clientOptions, deliverableOptions, projectOptions, staffOptions } from "@/features/common/lookups";
import { getProject, projectCounts } from "@/features/projects/queries";
import { deleteProject, saveProjectFinancials, setProjectStatus, updateProject } from "@/features/projects/actions";
import { ProjectFields } from "@/features/projects/components/project-form";
import { ProgressBar } from "@/features/projects/components/projects-table";
import { Milestones, type MilestoneRow } from "@/features/projects/components/milestones";
import { listDeliverables, approvalHistory } from "@/features/deliverables/queries";
import { DeliverablesTracker } from "@/features/deliverables/components/deliverables-tracker";
import { ApprovalHistory } from "@/features/deliverables/components/approval-history";
import { listTasks } from "@/features/tasks/queries";
import { createTask } from "@/features/tasks/actions";
import { TaskFields } from "@/features/tasks/components/task-form";
import { TaskTable } from "@/features/tasks/components/task-table";
import { TaskBoard } from "@/features/tasks/components/task-views";
import { listFiles } from "@/features/files/queries";
import { FileList } from "@/features/files/components/file-list";
import { FileUploadDialog } from "@/features/files/components/file-upload";
import { listInvoices, listPayments, listQuotations } from "@/features/finance/queries";
import { InvoicesTable, PaymentsTable, QuotationsTable } from "@/features/finance/components/finance-tables";
import { listActivity } from "@/features/activity/queries";
import { ActivityFeed } from "@/features/activity/activity-feed";
import { str } from "@/lib/list-params";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Project" };
type SP = Record<string, string | string[] | undefined>;

export default async function ProjectWorkspace({ params, searchParams }: PageProps<"/projects/[id]">) {
  const session = await requireStaff();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { project, members } = await getProject(id);
  if (!project) notFound();
  const counts = await projectCounts(id);
  const finance = can(session.role, "finance.view");
  const manage = can(session.role, "projects.manage");
  const ids = ["overview", "deliverables", "tasks", "files", "team", "milestones", "approvals", ...(finance ? ["quotations", "invoices", "payments"] : []), "activity"];
  const tab = currentTab(sp, ids);
  const labels: Record<string, [string, number | null]> = {
    overview: ["Overview", null], deliverables: ["Deliverables", counts.deliverables], tasks: ["Tasks", counts.tasks], files: ["Files", counts.files], team: ["Team", members.length],
    milestones: ["Milestones", counts.milestones], approvals: ["Client approvals", counts.pendingApprovals || null], quotations: ["Quotations", null], invoices: ["Invoices", null], payments: ["Payments", null], activity: ["Activity", null],
  };
  const [staff, clients] = await Promise.all([staffOptions(session.orgId), manage ? clientOptions() : Promise.resolve([])]);
  const due = daysUntil(project.due_date);
  const listSp = { ...sp, tab: undefined };

  return (
    <>
      <PageHeader
        title={project.name}
        breadcrumbs={[{ label: "Projects", href: "/projects" }, ...(project.client ? [{ label: project.client.company_name, href: `/clients/${project.client_id}` }] : []), { label: project.code }]}
        meta={<>
          <StatusBadge def={PROJECT_STATUS} value={project.status} />
          <StatusBadge def={PRIORITY} value={project.priority} />
          <Pill>{PROJECT_CATEGORY.label[project.category as keyof typeof PROJECT_CATEGORY.label]}</Pill>
          {!project.client_visible && <Pill tone="slate">Hidden from client</Pill>}
        </>}
        actions={manage && <>
          <StatusSelect value={project.status} options={PROJECT_STATUS.options} onChange={setProjectStatus.bind(null, id)} className="h-8" />
          <FormSheet trigger={<Button variant="outline"><Pencil /> Edit</Button>} title="Edit project" action={updateProject.bind(null, id)}>
            <ProjectFields project={project} clients={clients} staff={staff} memberIds={members.map((m) => m.user_id)} />
          </FormSheet>
          {finance && <Button variant="outline" render={<Link href={`/invoices/new?client=${project.client_id}&project=${id}`} />}><Receipt /> Invoice</Button>}
        </>}
      />
      <TabNav base={`/projects/${id}`} current={tab} tabs={ids.map((t) => ({ id: t, label: labels[t]![0], count: labels[t]![1] }))} />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Progress</p><p className="mt-1 text-2xl font-semibold tabular-nums">{project.progress}%</p><ProgressBar value={project.progress} className="mt-2" /><p className="mt-1 text-[11px] text-muted-foreground">{project.progress_mode === "auto" ? (counts.deliverables ? "From approved deliverables" : "From completed tasks") : "Set manually"}</p></div>
            <StatCard label="Delivery date" value={formatDate(project.due_date)} hint={due === null ? undefined : due < 0 ? `${-due} days overdue` : `${due} days left`} icon={CalendarDays} tone={due !== null && due < 0 && !["completed", "cancelled"].includes(project.status) ? "danger" : "default"} />
            <StatCard label="Deliverables" value={counts.deliverables} hint={counts.pendingApprovals ? `${counts.pendingApprovals} awaiting client` : undefined} icon={Layers} />
            <StatCard label="Tasks" value={counts.tasks} icon={CheckSquare} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Panel title="About this project">
              {project.description ? <p className="mb-5 text-sm whitespace-pre-wrap">{project.description}</p> : null}
              <DescriptionList items={[
                { label: "Project ID", value: project.code },
                { label: "Client", value: project.client && <Link href={`/clients/${project.client_id}`} className="text-primary hover:underline">{project.client.company_name}</Link> },
                { label: "Start date", value: formatDate(project.start_date) },
                { label: "Expected delivery", value: formatDate(project.due_date) },
                { label: "Budget", value: finance || manage ? (project.budget ? formatINR(project.budget) : "—") : "—" },
                { label: "Project manager", value: <PersonCell name={project.manager?.full_name} /> },
              ]} />
            </Panel>
            <div className="space-y-6">
              {can(session.role, "profitability.view") && <Profitability projectId={id} budget={Number(project.budget ?? 0)} />}
              <Panel title="Recent activity"><ActivityFeed items={await listActivity({ projectId: id, limit: 8 })} showVisibility /></Panel>
            </div>
          </div>
          {manage && can(session.role, "projects.delete") && (
            <div className="flex justify-end">
              <ConfirmAction trigger={<Button variant="ghost" className="text-destructive"><Trash2 /> Delete project</Button>} title={`Delete ${project.name}?`} description="Deletes the project with all deliverables, tasks, milestones and file records. Projects with issued invoices can't be deleted." action={deleteProject.bind(null, id)} />
            </div>
          )}
        </div>
      )}

      {tab === "deliverables" && <DeliverablesTracker projectId={id} rows={await listDeliverables(id)} staff={staff} canManage={manage} />}
      {tab === "tasks" && <TasksTab projectId={id} sp={listSp} session={session} staff={staff} />}
      {tab === "files" && <FilesTab projectId={id} clientId={project.client_id} sp={listSp} canManage={manage} canDelete={can(session.role, "files.delete")} />}
      {tab === "team" && (
        <Panel title="Project team" description={manage ? "Edit the project to change the manager or team." : undefined}>
          {members.length === 0 && !project.manager ? <EmptyState icon={Users} title="No team assigned" /> : (
            <ul className="divide-y">
              {project.manager && <li className="flex items-center justify-between py-3"><PersonCell name={project.manager.full_name} /><Pill tone="purple">Project manager</Pill></li>}
              {members.map((m) => <li key={m.user_id} className="flex items-center justify-between py-3"><PersonCell name={m.profile?.full_name} sub={m.profile?.email} /><Pill>{m.role_label ?? "Team"}</Pill></li>)}
            </ul>
          )}
        </Panel>
      )}
      {tab === "milestones" && <MilestonesTab projectId={id} canManage={manage} />}
      {tab === "approvals" && <ApprovalHistory projectId={id} {...await approvalHistory(id)} />}
      {tab === "quotations" && <QuotationsTab projectId={id} sp={listSp} clientId={project.client_id} />}
      {tab === "invoices" && <InvoicesTab projectId={id} sp={listSp} clientId={project.client_id} />}
      {tab === "payments" && <PaymentsTab projectId={id} sp={listSp} />}
      {tab === "activity" && <Panel title="Activity"><ActivityFeed items={await listActivity({ projectId: id, limit: 100 })} showVisibility /></Panel>}
    </>
  );
}

async function Profitability({ projectId, budget }: { projectId: string; budget: number }) {
  const supabase = await createClient();
  const [{ data: fin }, { data: pays }] = await Promise.all([
    supabase.from("project_financials").select("estimated_cost, actual_cost, notes").eq("project_id", projectId).maybeSingle(),
    supabase.from("payments").select("amount").eq("project_id", projectId),
  ]);
  const received = (pays ?? []).reduce((a, p) => a + Number(p.amount), 0);
  const cost = Number(fin?.actual_cost ?? 0) || Number(fin?.estimated_cost ?? 0);
  const margin = budget ? Math.round(((budget - cost) / budget) * 100) : null;
  return (
    <Panel title="Profitability" description="Admin only — never shown to managers, team or clients.">
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div><p className="text-xs text-muted-foreground">Budget</p><p className="font-semibold tabular-nums">{formatINR(budget)}</p></div>
        <div><p className="text-xs text-muted-foreground">Received</p><p className="font-semibold tabular-nums">{formatINR(received)}</p></div>
        <div><p className="text-xs text-muted-foreground">Margin</p><p className={cn("font-semibold tabular-nums", margin !== null && margin < 20 && "text-destructive")}>{margin === null ? "—" : `${margin}%`}</p></div>
      </div>
      <ActionForm action={saveProjectFinancials.bind(null, projectId)} className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field name="estimated_cost" label="Estimated cost (₹)"><Input name="estimated_cost" inputMode="decimal" defaultValue={fin?.estimated_cost ?? ""} /></Field>
          <Field name="actual_cost" label="Actual cost (₹)"><Input name="actual_cost" inputMode="decimal" defaultValue={fin?.actual_cost ?? ""} /></Field>
        </div>
        <Field name="notes" label="Cost notes"><Textarea name="notes" rows={2} defaultValue={fin?.notes ?? ""} /></Field>
        <div className="flex justify-end"><SubmitButton>Save costs</SubmitButton></div>
      </ActionForm>
    </Panel>
  );
}

async function TasksTab({ projectId, sp, session, staff }: { projectId: string; sp: SP; session: Awaited<ReturnType<typeof requireStaff>>; staff: Awaited<ReturnType<typeof staffOptions>> }) {
  const board = str(sp, "view") === "board";
  const [{ rows }, projects, deliverables] = await Promise.all([listTasks(sp, { projectId }, { all: true, userId: session.userId }), projectOptions(), deliverableOptions(projectId)]);
  const canApprove = can(session.role, "tasks.manage");
  return (
    <Panel title="Tasks" bodyClassName="p-0" action={
      <div className="flex gap-2">
        <Button size="sm" variant="outline" render={<Link href={`/projects/${projectId}?tab=tasks${board ? "" : "&view=board"}`} scroll={false} />}>{board ? "List view" : "Board view"}</Button>
        <FormSheet trigger={<Button size="sm"><Plus /> Task</Button>} title="New task" action={createTask}><TaskFields staff={staff} projects={projects} deliverables={deliverables} fixedProjectId={projectId} canApprove={canApprove} /></FormSheet>
      </div>
    }>
      {rows.length === 0 ? <EmptyState icon={CheckSquare} title="No tasks yet" /> : board ? <div className="p-3"><TaskBoard tasks={rows} canApprove={canApprove} /></div> : <TaskTable rows={rows} canApprove={canApprove} showProject={false} />}
    </Panel>
  );
}

async function FilesTab({ projectId, clientId, sp, canManage, canDelete }: { projectId: string; clientId: string; sp: SP; canManage: boolean; canDelete: boolean }) {
  const { rows } = await listFiles(sp, { projectId });
  const folders = [...new Set(rows.map((f) => f.folder))].sort();
  return (
    <Panel title="Project files" description={folders.length ? `Folders: ${folders.join(" · ")}` : "Organise files into folders like Briefs, Drafts, Finals."} action={<FileUploadDialog projectId={projectId} clientId={clientId} />} bodyClassName="p-0">
      {rows.length ? <FileList files={rows} canManage={canManage} canDelete={canDelete} /> : <EmptyState title="No files yet" description="Upload briefs, content, drafts and final artwork." />}
    </Panel>
  );
}

async function MilestonesTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.from("project_milestones").select("id, title, description, due_date, amount, status, client_visible, completed_at").eq("project_id", projectId).order("position");
  return <Panel title="Milestones"><Milestones projectId={projectId} rows={(data ?? []) as MilestoneRow[]} canManage={canManage} /></Panel>;
}

async function QuotationsTab({ projectId, sp, clientId }: { projectId: string; sp: SP; clientId: string }) {
  const { rows } = await listQuotations(sp, { projectId });
  return <Panel title="Quotations" bodyClassName="p-0" action={<Button size="sm" render={<Link href={`/quotations/new?client=${clientId}&project=${projectId}`} />}><Plus /> New</Button>}>{rows.length ? <QuotationsTable rows={rows} sortable={false} /> : <EmptyState icon={FileText} title="No quotations linked" />}</Panel>;
}

async function InvoicesTab({ projectId, sp, clientId }: { projectId: string; sp: SP; clientId: string }) {
  const { rows } = await listInvoices(sp, { projectId });
  return <Panel title="Invoices" bodyClassName="p-0" action={<Button size="sm" render={<Link href={`/invoices/new?client=${clientId}&project=${projectId}`} />}><Plus /> New</Button>}>{rows.length ? <InvoicesTable rows={rows} sortable={false} /> : <EmptyState icon={Receipt} title="No invoices yet" />}</Panel>;
}

async function PaymentsTab({ projectId, sp }: { projectId: string; sp: SP }) {
  const { rows } = await listPayments(sp, { projectId });
  return <Panel title="Payments" description={`${formatINR(rows.reduce((a, p) => a + Number(p.amount), 0))} received`} bodyClassName="p-0">{rows.length ? <PaymentsTable rows={rows} sortable={false} /> : <EmptyState icon={Wallet} title="No payments yet" />}</Panel>;
}
