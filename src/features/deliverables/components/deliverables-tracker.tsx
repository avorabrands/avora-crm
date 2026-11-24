"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, Plus, Send, Trash2, Truck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog, NativeSelect } from "@/components/app/form";
import { ConfirmAction } from "@/components/app/confirm";
import { Pill, StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { APPROVAL_STATUS, DESIGN_STATUS, REVIEW_STATUS } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Option } from "@/features/common/lookups";
import type { FormActionState } from "@/components/app/form";
import { addDeliverables, bulkUploadDeliverableFiles, deleteDeliverables, recordClientDecision, sendDeliverablesToClient, updateDeliverables, uploadDeliverableFile, type DeliverablePatch } from "../actions";
import type { DeliverableRow } from "../queries";

type Props = { projectId: string; rows: DeliverableRow[]; staff: Option[]; canManage: boolean };

export function DeliverablesTracker({ projectId, rows, staff, canManage }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("all");
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<FormActionState>, clear = false) => start(async () => {
    const res = await fn();
    if (res.ok) { if (res.message) toast.success(res.message); if (clear) setSelected(new Set()); router.refresh(); }
    else toast.error(res.message ?? "Update failed");
  });
  const patch = (ids: string[], p: DeliverablePatch, clear = false) => run(() => updateDeliverables(projectId, ids, p), clear);

  const stats = useMemo(() => {
    const total = rows.length;
    const c = (f: (d: DeliverableRow) => boolean) => rows.filter(f).length;
    return {
      total,
      content: c((d) => d.content_received),
      designing: c((d) => d.design_status === "in_progress"),
      internal: c((d) => d.internal_review_status === "pending"),
      clientReview: c((d) => d.client_review_status === "pending"),
      revision: c((d) => d.approval_status === "revision_requested"),
      approved: c((d) => d.approval_status === "approved"),
      delivered: c((d) => !!d.final_delivered_at),
    };
  }, [rows]);

  const visible = rows.filter((d) => {
    switch (filter) {
      case "no_content": return !d.content_received;
      case "designing": return d.design_status !== "completed";
      case "internal": return d.internal_review_status === "pending";
      case "client": return d.client_review_status === "pending";
      case "revision": return d.approval_status === "revision_requested";
      case "approved": return d.approval_status === "approved";
      default: return true;
    }
  });
  const ids = [...selected];
  const allChecked = visible.length > 0 && visible.every((d) => selected.has(d.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(visible.map((d) => d.id)));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pct = stats.total ? Math.round((stats.approved / stats.total) * 100) : 0;

  const addButton = canManage && (
    <FormDialog trigger={<Button><Plus /> Add deliverables</Button>} title="Add deliverables" description="One per line — e.g. each course in a brochure series." action={addDeliverables.bind(null, projectId)} submitLabel="Add">
      <Field name="names" label="Deliverable names" required hint="Paste a list; each line becomes one deliverable."><Textarea name="names" rows={8} placeholder={"B.Sc Nursing\nBPT — Physiotherapy\nMBA Hospital Management"} /></Field>
      <Field name="assigned_to" label="Assign designer (optional)">
        <NativeSelect name="assigned_to" defaultValue=""><option value="">Unassigned</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</NativeSelect>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="content_received" className="size-4 accent-primary" /> Content already received from client</label>
    </FormDialog>
  );

  if (!rows.length) return <EmptyState icon={FileUp} title="No deliverables yet" description="Break this project into individual deliverables (e.g. 34 course brochures) to track each one through design, review and approval." action={addButton} />;

  const STAGES = [
    { key: "all", label: "All", value: stats.total },
    { key: "no_content", label: "Awaiting content", value: stats.total - stats.content },
    { key: "designing", label: "In design", value: stats.total - rows.filter((d) => d.design_status === "completed").length },
    { key: "internal", label: "Internal review", value: stats.internal },
    { key: "client", label: "Client review", value: stats.clientReview },
    { key: "revision", label: "Revisions", value: stats.revision },
    { key: "approved", label: "Approved", value: stats.approved },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Overall progress (approved ÷ total)</p>
            <p className="text-2xl font-semibold tabular-nums">{stats.approved} <span className="text-base font-normal text-muted-foreground">/ {stats.total} approved · {pct}%</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            {addButton}
            <FormDialog trigger={<Button variant="outline"><Upload /> Bulk upload</Button>} title="Bulk upload designs" description="Files are matched to deliverables by name — e.g. “MBA Hospital Management.pdf”. Each match becomes a new version awaiting internal review." action={bulkUploadDeliverableFiles.bind(null, projectId)} submitLabel="Upload & match">
              <Field name="files" label="Design files" required><Input type="file" name="files" multiple className="h-auto py-1.5" /></Field>
            </FormDialog>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button key={s.key} onClick={() => setFilter(s.key)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", filter === s.key ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
              {s.label} <span className="ml-1 font-semibold tabular-nums">{s.value}</span>
            </button>
          ))}
        </div>
      </div>

      {ids.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-accent p-2.5 text-sm shadow-sm">
          <span className="px-1 font-medium">{ids.length} selected</span>
          <select className="field-select w-auto" value="" onChange={(e) => e.target.value && patch(ids, { design_status: e.target.value as DeliverablePatch["design_status"] })} aria-label="Set design status">
            <option value="">Design status…</option>{DESIGN_STATUS.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="field-select w-auto" value="" onChange={(e) => e.target.value && patch(ids, { assigned_to: e.target.value === "none" ? null : e.target.value })} aria-label="Assign designer">
            <option value="">Assign designer…</option><option value="none">Unassign</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => patch(ids, { content_received: true })}>Content received</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => patch(ids, { internal_review_status: "approved" })}><CheckCircle2 /> Internal OK</Button>
          {canManage && <>
            <Button size="sm" disabled={pending} onClick={() => run(() => sendDeliverablesToClient(projectId, ids), true)}><Send /> Send to client</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => patch(ids, { final_delivered_at: todayISO() }, true)}><Truck /> Mark delivered</Button>
            <ConfirmAction trigger={<Button size="sm" variant="ghost" className="text-destructive"><Trash2 /> Delete</Button>} title={`Delete ${ids.length} deliverable(s)?`} description="Their approval history is removed too. Uploaded files stay in project Files." action={() => deleteDeliverables(projectId, ids)} onDone={() => setSelected(new Set())} />
          </>}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          {pending && <Loader2 className="size-4 animate-spin" />}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" className="size-4 accent-primary" /></th>
              <th className="w-8 py-2.5">#</th>
              <th className="py-2.5 pr-3">Deliverable</th>
              <th className="px-2 py-2.5">Content</th>
              <th className="px-2 py-2.5">Design</th>
              <th className="px-2 py-2.5">Designer</th>
              <th className="px-2 py-2.5">Internal review</th>
              <th className="px-2 py-2.5">Client review</th>
              <th className="px-2 py-2.5 text-center">Rev.</th>
              <th className="px-2 py-2.5">Approval</th>
              <th className="px-2 py-2.5">Submitted</th>
              <th className="px-2 py-2.5">Delivered</th>
              <th className="px-3 py-2.5">File</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d, i) => (
              <tr key={d.id} className={cn("border-b last:border-0 hover:bg-muted/30", selected.has(d.id) && "bg-accent/40")}>
                <td className="px-3 py-2"><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} aria-label={`Select ${d.name}`} className="size-4 accent-primary" /></td>
                <td className="py-2 text-xs text-muted-foreground tabular-nums">{d.position || i + 1}</td>
                <td className="max-w-64 py-2 pr-3">
                  <p className="truncate font-medium" title={d.name}>{d.name}</p>
                  {d.client_visible && <span className="text-[11px] text-teal-600 dark:text-teal-400">Shared with client</span>}
                </td>
                <td className="px-2 py-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={d.content_received} onChange={(e) => patch([d.id], { content_received: e.target.checked })} className="size-4 accent-primary" />
                    {d.content_received ? formatDate(d.content_received_at, "dd MMM") : "Pending"}
                  </label>
                </td>
                <td className="px-2 py-2">
                  <select className="field-select h-7 w-32 text-xs" value={d.design_status} onChange={(e) => patch([d.id], { design_status: e.target.value as DeliverablePatch["design_status"] })} aria-label="Design status">
                    {DESIGN_STATUS.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select className="field-select h-7 w-36 text-xs" value={d.assigned_to ?? ""} onChange={(e) => patch([d.id], { assigned_to: e.target.value || null })} aria-label="Designer">
                    <option value="">Unassigned</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select className="field-select h-7 w-36 text-xs" value={d.internal_review_status} onChange={(e) => patch([d.id], { internal_review_status: e.target.value as DeliverablePatch["internal_review_status"] })} aria-label="Internal review">
                    {REVIEW_STATUS.options.map((o) => <option key={o.value} value={o.value}>{o.value === "not_started" ? "Not started" : o.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2"><StatusBadge def={REVIEW_STATUS} value={d.client_review_status} /></td>
                <td className="px-2 py-2 text-center tabular-nums">{d.revision_count > 0 ? <Pill tone="amber">{d.revision_count}</Pill> : <span className="text-muted-foreground">0</span>}</td>
                <td className="px-2 py-2">
                  <StatusBadge def={APPROVAL_STATUS} value={d.approval_status} />
                  {d.approved_at && <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(d.approved_at, "dd MMM, h:mm a")}</p>}
                </td>
                <td className="px-2 py-2 text-xs">{formatDate(d.submitted_at, "dd MMM")}</td>
                <td className="px-2 py-2">
                  {canManage ? (
                    <input type="date" className="field-select h-7 w-34 text-xs" value={d.final_delivered_at ?? ""} onChange={(e) => patch([d.id], { final_delivered_at: e.target.value || null })} aria-label="Final delivery date" />
                  ) : <span className="text-xs">{formatDate(d.final_delivered_at, "dd MMM")}</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {d.file ? <a href={`/api/files/${d.file.id}`} target="_blank" rel="noreferrer" className="max-w-28 truncate text-xs text-primary hover:underline" title={d.file.name}>v{d.file.version} · {d.file.name}</a> : <span className="text-xs text-muted-foreground">No file</span>}
                    <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="Upload design"><Upload /></Button>} title={`Upload design · ${d.name}`} description={d.file ? `Becomes v${d.file.version + 1}; earlier versions stay in history.` : "First version of this design."} action={uploadDeliverableFile.bind(null, projectId, d.id)} submitLabel="Upload">
                      <Field name="file" label="Design file" required><Input type="file" name="file" className="h-auto py-1.5" /></Field>
                    </FormDialog>
                    {canManage && d.client_review_status === "pending" && (
                      <RecordDecision projectId={projectId} id={d.id} name={d.name} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordDecision({ projectId, id, name }: { projectId: string; id: string; name: string }) {
  return (
    <FormDialog
      trigger={<Button variant="ghost" size="xs">Record</Button>}
      title={`Record client decision · ${name}`}
      description="Use this when the client replied by email or phone instead of the portal."
      action={async (_s, fd) => recordClientDecision(projectId, id, fd.get("decision") as "approved" | "revision_requested", String(fd.get("comment") ?? ""))}
      submitLabel="Record"
    >
      <Field name="decision" label="Decision"><NativeSelect name="decision" defaultValue="approved"><option value="approved">Approved</option><option value="revision_requested">Revision requested</option></NativeSelect></Field>
      <Field name="comment" label="Client feedback" hint="Required for revisions"><Textarea name="comment" rows={3} /></Field>
    </FormDialog>
  );
}
