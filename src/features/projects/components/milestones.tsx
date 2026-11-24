"use client";

import { Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog, NativeSelect } from "@/components/app/form";
import { RowActions } from "@/components/app/row-actions";
import { Pill, StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { MILESTONE_STATUS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/format";
import { deleteMilestone, saveMilestone } from "../actions";

export type MilestoneRow = { id: string; title: string; description: string | null; due_date: string | null; amount: number | null; status: string; client_visible: boolean; completed_at: string | null };

function MilestoneFields({ m }: { m?: MilestoneRow }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label="Title" required className="sm:col-span-2"><Input name="title" defaultValue={m?.title ?? ""} placeholder="First draft of all brochures" /></Field>
      <Field name="due_date" label="Due date"><Input type="date" name="due_date" defaultValue={m?.due_date ?? ""} /></Field>
      <Field name="amount" label="Billing amount (₹)" hint="For milestone-based invoicing"><Input name="amount" inputMode="decimal" defaultValue={m?.amount ?? ""} /></Field>
      <Field name="status" label="Status"><NativeSelect name="status" defaultValue={m?.status ?? "pending"}>{MILESTONE_STATUS.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
      <Field name="description" label="Description" className="sm:col-span-2"><Textarea name="description" rows={2} defaultValue={m?.description ?? ""} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="client_visible" defaultChecked={m?.client_visible ?? true} className="size-4 accent-primary" /> Visible to client</label>
    </div>
  );
}

export function Milestones({ projectId, rows, canManage }: { projectId: string; rows: MilestoneRow[]; canManage: boolean }) {
  const add = canManage && (
    <FormDialog trigger={<Button><Plus /> Add milestone</Button>} title="Add milestone" action={saveMilestone.bind(null, projectId, null)}><MilestoneFields /></FormDialog>
  );
  if (!rows.length) return <EmptyState icon={Flag} title="No milestones" description="Break delivery into checkpoints — and bill against them." action={add} />;
  return (
    <div className="space-y-3">
      {canManage && <div className="flex justify-end">{add}</div>}
      <ol className="space-y-3">
        {rows.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
            <div className="flex gap-3">
              <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${m.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-accent text-accent-foreground"}`}><Flag className="size-3.5" /></span>
              <div>
                <p className="font-medium">{m.title}</p>
                {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge def={MILESTONE_STATUS} value={m.status} />
                  <span>Due {formatDate(m.due_date)}</span>
                  {m.amount ? <span>· {formatINR(m.amount)}</span> : null}
                  {!m.client_visible && <Pill>Internal</Pill>}
                </div>
              </div>
            </div>
            {canManage && <RowActions editAs="dialog" editTitle="Edit milestone" edit={saveMilestone.bind(null, projectId, m.id)} editForm={<MilestoneFields m={m} />} onDelete={() => deleteMilestone(projectId, m.id)} deleteTitle={`Delete “${m.title}”?`} />}
          </li>
        ))}
      </ol>
    </div>
  );
}
