"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/app/form";
import { PRIORITY, PROJECT_CATEGORY, PROJECT_STATUS } from "@/lib/constants";
import type { Option } from "@/features/common/lookups";
import type { ProjectRow } from "../queries";

export function ProjectFields({ project, clients, staff, memberIds = [], defaultClientId }: { project?: Partial<ProjectRow>; clients: Option[]; staff: Option[]; memberIds?: string[]; defaultClientId?: string }) {
  const [mode, setMode] = useState(project?.progress_mode ?? "auto");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="name" label="Project name" required className="sm:col-span-2"><Input name="name" defaultValue={project?.name ?? ""} placeholder="Course Creative Design" autoFocus /></Field>
      <Field name="client_id" label="Client" required>
        <NativeSelect name="client_id" defaultValue={project?.client_id ?? defaultClientId ?? ""}><option value="">Choose client</option>{clients.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</NativeSelect>
      </Field>
      <Field name="category" label="Category" required>
        <NativeSelect name="category" defaultValue={project?.category ?? "graphic_design"}>{PROJECT_CATEGORY.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
      </Field>
      <Field name="description" label="Description" className="sm:col-span-2"><Textarea name="description" rows={3} defaultValue={project?.description ?? ""} /></Field>
      <Field name="start_date" label="Start date"><Input type="date" name="start_date" defaultValue={project?.start_date ?? ""} /></Field>
      <Field name="due_date" label="Expected delivery"><Input type="date" name="due_date" defaultValue={project?.due_date ?? ""} /></Field>
      <Field name="budget" label="Project budget (₹)"><Input name="budget" inputMode="decimal" defaultValue={project?.budget ?? ""} /></Field>
      <Field name="priority" label="Priority"><NativeSelect name="priority" defaultValue={project?.priority ?? "medium"}>{PRIORITY.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
      <Field name="manager_id" label="Project manager">
        <NativeSelect name="manager_id" defaultValue={project?.manager_id ?? ""}><option value="">Unassigned</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</NativeSelect>
      </Field>
      <Field name="status" label="Status"><NativeSelect name="status" defaultValue={project?.status ?? "not_started"}>{PROJECT_STATUS.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
      <Field label="Assigned designers / team" className="sm:col-span-2">
        <div className="flex flex-wrap gap-2">
          {staff.map((s) => (
            <label key={s.value} className="flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground">
              <input type="checkbox" name="member_ids[]" value={s.value} defaultChecked={memberIds.includes(s.value)} className="sr-only" />{s.label}
            </label>
          ))}
        </div>
      </Field>
      <Field name="progress_mode" label="Progress">
        <NativeSelect name="progress_mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="auto">Automatic (deliverables, else tasks)</option><option value="manual">Manual</option>
        </NativeSelect>
      </Field>
      {mode === "manual" ? (
        <Field name="progress" label="Progress %"><Input type="number" min={0} max={100} name="progress" defaultValue={project?.progress ?? 0} /></Field>
      ) : <input type="hidden" name="progress" value={project?.progress ?? 0} />}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="client_visible" defaultChecked={project?.client_visible ?? true} className="size-4 accent-primary" /> Show this project in the client portal
      </label>
    </div>
  );
}
