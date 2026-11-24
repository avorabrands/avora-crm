"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/app/form";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import type { Option } from "@/features/common/lookups";
import type { TaskRow } from "../queries";

export type DeliverableOption = { value: string; label: string; projectId: string };

export function TaskFields({ task, staff, projects, deliverables = [], fixedProjectId, canApprove }: {
  task?: Partial<TaskRow>; staff: Option[]; projects: Option[]; deliverables?: DeliverableOption[]; fixedProjectId?: string; canApprove: boolean;
}) {
  const [projectId, setProjectId] = useState(task?.project_id ?? fixedProjectId ?? "");
  const statusOptions = canApprove ? TASK_STATUS.options : TASK_STATUS.options.filter((o) => ["todo", "in_progress", "internal_review"].includes(o.value) || o.value === task?.status);
  const dels = deliverables.filter((d) => d.projectId === projectId);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label="Task title" required className="sm:col-span-2"><Input name="title" defaultValue={task?.title ?? ""} autoFocus /></Field>
      {fixedProjectId ? <input type="hidden" name="project_id" value={fixedProjectId} /> : (
        <Field name="project_id" label="Project" required className="sm:col-span-2">
          <NativeSelect name="project_id" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Choose project</option>{projects.map((p) => <option key={p.value} value={p.value}>{p.label}{p.sub ? ` · ${p.sub}` : ""}</option>)}
          </NativeSelect>
        </Field>
      )}
      {dels.length > 0 && (
        <Field name="deliverable_id" label="Deliverable (optional)" className="sm:col-span-2">
          <NativeSelect name="deliverable_id" defaultValue={task?.deliverable_id ?? ""}><option value="">—</option>{dels.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</NativeSelect>
        </Field>
      )}
      <Field name="assigned_to" label="Assigned to">
        <NativeSelect name="assigned_to" defaultValue={task?.assigned_to ?? ""}><option value="">Unassigned</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</NativeSelect>
      </Field>
      <Field name="priority" label="Priority">
        <NativeSelect name="priority" defaultValue={task?.priority ?? "medium"}>{PRIORITY.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
      </Field>
      <Field name="start_date" label="Start date"><Input type="date" name="start_date" defaultValue={task?.start_date ?? ""} /></Field>
      <Field name="due_date" label="Due date"><Input type="date" name="due_date" defaultValue={task?.due_date ?? ""} /></Field>
      <Field name="status" label="Status" className="sm:col-span-2">
        <NativeSelect name="status" defaultValue={task?.status ?? "todo"}>{statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
      </Field>
      <Field name="description" label="Description" className="sm:col-span-2"><Textarea name="description" rows={4} defaultValue={task?.description ?? ""} /></Field>
    </div>
  );
}
