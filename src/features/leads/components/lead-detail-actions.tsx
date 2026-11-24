"use client";

import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/app/confirm";
import { ActionForm, Field, FormDialog, FormSheet, NativeSelect, SubmitButton, type FormAction } from "@/components/app/form";
import { StatusSelect } from "@/components/app/status-select";
import { LEAD_STATUS, PROJECT_CATEGORY } from "@/lib/constants";
import type { Option } from "@/features/common/lookups";
import { deleteLead, setLeadStatus } from "../actions";
import { LeadFields } from "./lead-form";
import type { LeadRow } from "../queries";

export function LeadHeaderActions({ lead, staff, update, convert, canManage, canDelete }: {
  lead: LeadRow; staff: Option[]; update: FormAction; convert: FormAction; canManage: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const [withProject, setWithProject] = useState(true);
  return (
    <>
      <StatusSelect value={lead.status} options={LEAD_STATUS.options} onChange={(v) => setLeadStatus(lead.id, v)} disabled={!!lead.converted_client_id} className="h-8" />
      <FormSheet trigger={<Button variant="outline"><Pencil /> Edit</Button>} title={`Edit ${lead.code}`} action={update}>
        <LeadFields staff={staff} lead={lead} />
      </FormSheet>
      {canManage && !lead.converted_client_id && lead.status !== "lost" && (
        <FormDialog
          trigger={<Button><ArrowRightLeft /> Convert to client</Button>}
          title="Convert lead to client"
          description={`Creates a client profile for ${lead.company_name}, marks the lead as won and optionally opens a project.`}
          action={convert}
          submitLabel="Convert"
        >
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="create_project" checked={withProject} onChange={(e) => setWithProject(e.target.checked)} className="size-4 accent-primary" />
            Also create a project
          </label>
          {withProject && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="project_name" label="Project name" required className="sm:col-span-2"><Input name="project_name" defaultValue={lead.services[0] ? `${lead.services[0]} — ${lead.company_name}` : ""} /></Field>
              <Field name="category" label="Category">
                <NativeSelect name="category" defaultValue="custom">{PROJECT_CATEGORY.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
              </Field>
              <Field name="budget" label="Budget (₹)"><Input name="budget" inputMode="decimal" defaultValue={lead.estimated_budget ?? ""} /></Field>
            </div>
          )}
        </FormDialog>
      )}
      {canDelete && (
        <ConfirmAction
          trigger={<Button variant="ghost" size="icon" aria-label="Delete lead" className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>}
          title={`Delete ${lead.company_name}?`}
          description="The lead and its follow-up history will be permanently removed. This cannot be undone."
          action={() => deleteLead(lead.id)}
          onDone={() => router.push("/leads")}
        />
      )}
    </>
  );
}

export function ActivityComposer({ action }: { action: FormAction }) {
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field name="type" label="Type">
          <NativeSelect name="type" defaultValue="note">
            <option value="note">Note</option><option value="call">Call</option><option value="email">Email</option>
            <option value="meeting">Meeting</option><option value="follow_up">Follow-up</option>
          </NativeSelect>
        </Field>
        <Field name="follow_up_date" label="Schedule next follow-up (optional)"><Input type="date" name="follow_up_date" /></Field>
      </div>
      <Field name="content" label="Details"><Textarea name="content" rows={3} placeholder="What was discussed? Any requirements or next steps?" /></Field>
      <div className="flex justify-end"><SubmitButton>Add to timeline</SubmitButton></div>
    </ActionForm>
  );
}
