import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { APPROVAL_STATUS, MILESTONE_STATUS, PROJECT_STATUS } from "@/lib/constants";
import { formatDate, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { DescriptionList, Panel } from "@/components/app/panel";
import { StatusBadge } from "@/components/app/status-badge";
import { ProgressBar } from "@/features/projects/components/projects-table";
import { portalDeliverables } from "@/features/portal/queries";

export default async function PortalProject({ params }: PageProps<"/portal/projects/[id]">) {
  await requireClient();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, dels, { data: ms }, { data: files }, { data: updates }] = await Promise.all([
    supabase.from("projects").select("id, name, code, description, status, progress, start_date, due_date").eq("id", id).maybeSingle(),
    portalDeliverables({ projectId: id }),
    supabase.from("project_milestones").select("id, title, due_date, status").eq("project_id", id).order("position"),
    supabase.from("files").select("id, name, version, created_at, folder").eq("project_id", id).eq("is_latest", true).order("created_at", { ascending: false }).limit(20),
    supabase.from("activity_logs").select("id, summary, created_at").eq("project_id", id).eq("client_visible", true).order("created_at", { ascending: false }).limit(15),
  ]);
  if (!p) notFound();
  const approved = dels.filter((d) => d.approval_status === "approved").length;
  return (
    <>
      <PageHeader title={p.name} breadcrumbs={[{ label: "My projects", href: "/portal/projects" }, { label: p.code }]} meta={<StatusBadge def={PROJECT_STATUS} value={p.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Overview">
            <ProgressBar value={p.progress} />
            {dels.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{approved} of {dels.length} shared deliverables approved</p>}
            {p.description && <p className="mt-4 text-sm whitespace-pre-wrap">{p.description}</p>}
            <div className="mt-4"><DescriptionList items={[{ label: "Start date", value: formatDate(p.start_date) }, { label: "Expected delivery", value: formatDate(p.due_date) }]} /></div>
          </Panel>
          <Panel title="Deliverables" bodyClassName="p-0">
            {dels.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Designs will appear here when they&apos;re ready for you.</p> : (
              <ul className="divide-y">{dels.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.file ? `v${d.file.version}` : "No file yet"}{d.revision_count ? ` · ${d.revision_count} revision(s)` : ""}</p></div>
                  <StatusBadge def={APPROVAL_STATUS} value={d.approval_status} />
                </li>
              ))}</ul>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Milestones">{(ms ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No milestones shared.</p> : <ul className="space-y-2">{(ms ?? []).map((m) => <li key={m.id} className="flex items-center justify-between gap-2 text-sm"><span>{m.title}<span className="block text-xs text-muted-foreground">{formatDate(m.due_date)}</span></span><StatusBadge def={MILESTONE_STATUS} value={m.status} /></li>)}</ul>}</Panel>
          <Panel title="Shared files">{(files ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No files shared yet.</p> : <ul className="space-y-2">{(files ?? []).map((f) => <li key={f.id}><a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{f.name}</a> <span className="text-xs text-muted-foreground">v{f.version} · {f.folder}</span></li>)}</ul>}</Panel>
          <Panel title="Updates">{(updates ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No updates yet.</p> : <ul className="space-y-3">{(updates ?? []).map((u) => <li key={u.id} className="text-sm">{u.summary}<p className="text-xs text-muted-foreground">{formatRelative(u.created_at)}</p></li>)}</ul>}</Panel>
        </div>
      </div>
    </>
  );
}
