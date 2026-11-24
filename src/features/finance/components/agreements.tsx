"use client";

import { FileSignature, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, FormDialog, NativeSelect, type FormAction } from "@/components/app/form";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge, Pill } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { AGREEMENT_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Option } from "@/features/common/lookups";
import { deleteAgreement, saveAgreement } from "../invoice-actions";
import type { AgreementRow } from "../queries";

function AgreementFields({ a, clients, projects, fixedClientId }: { a?: AgreementRow; clients: Option[]; projects: (Option & { clientId: string })[]; fixedClientId?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label="Title" required className="sm:col-span-2"><Input name="title" defaultValue={a?.title ?? ""} placeholder="Master services agreement" /></Field>
      {fixedClientId ? <input type="hidden" name="client_id" value={fixedClientId} /> : (
        <Field name="client_id" label="Client" required>
          <NativeSelect name="client_id" defaultValue={a?.client_id ?? ""}><option value="">Choose client</option>{clients.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</NativeSelect>
        </Field>
      )}
      <Field name="project_id" label="Project (optional)">
        <NativeSelect name="project_id" defaultValue={a?.project_id ?? ""}><option value="">—</option>{projects.filter((p) => !fixedClientId || p.clientId === fixedClientId).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</NativeSelect>
      </Field>
      <Field name="status" label="Status"><NativeSelect name="status" defaultValue={a?.status ?? "draft"}>{AGREEMENT_STATUS.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
      <Field name="signed_date" label="Signed on"><Input type="date" name="signed_date" defaultValue={a?.signed_date ?? ""} /></Field>
      <Field name="start_date" label="Start date"><Input type="date" name="start_date" defaultValue={a?.start_date ?? ""} /></Field>
      <Field name="end_date" label="End date"><Input type="date" name="end_date" defaultValue={a?.end_date ?? ""} /></Field>
      <Field name="file" label={a?.file ? `Replace document (current: ${a.file.name})` : "Signed document (PDF)"} className="sm:col-span-2"><Input type="file" name="file" accept=".pdf,.doc,.docx,image/*" className="h-auto py-1.5" /></Field>
      <Field name="notes" label="Notes" className="sm:col-span-2"><Textarea name="notes" rows={2} defaultValue={a?.notes ?? ""} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="client_visible" defaultChecked={a?.client_visible ?? true} className="size-4 accent-primary" /> Visible to client in portal (once not a draft)</label>
    </div>
  );
}

export function AddAgreementButton(props: { clients: Option[]; projects: (Option & { clientId: string })[]; fixedClientId?: string }) {
  return (
    <FormDialog trigger={<Button><Plus /> Add agreement</Button>} title="Add agreement" action={saveAgreement.bind(null, null) as FormAction} size="lg">
      <AgreementFields {...props} />
    </FormDialog>
  );
}

export function AgreementsTable({ rows, clients, projects, canManage, showClient = true }: { rows: AgreementRow[]; clients: Option[]; projects: (Option & { clientId: string })[]; canManage: boolean; showClient?: boolean }) {
  if (!rows.length) return <EmptyState icon={FileSignature} title="No agreements" description="Upload signed contracts and track their status here." />;
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead className="pl-4">Agreement</TableHead>
        {showClient && <TableHead>Client</TableHead>}
        <TableHead>Status</TableHead>
        <TableHead>Signed</TableHead>
        <TableHead>Term</TableHead>
        <TableHead>Document</TableHead>
        <TableHead className="pr-4"><span className="sr-only">Actions</span></TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((a) => (
          <TableRow key={a.id}>
            <TableCell className="pl-4"><p className="font-medium">{a.title}</p>{a.project && <p className="text-xs text-muted-foreground">{a.project.name}</p>}</TableCell>
            {showClient && <TableCell label="Client">{a.client?.company_name}</TableCell>}
            <TableCell label="Status" className="space-x-1"><StatusBadge def={AGREEMENT_STATUS} value={a.status} />{a.client_visible && a.status !== "draft" && <Pill tone="teal">Shared</Pill>}</TableCell>
            <TableCell label="Signed" className="text-sm">{formatDate(a.signed_date)}</TableCell>
            <TableCell label="Term" className="text-xs text-muted-foreground">{a.start_date || a.end_date ? `${formatDate(a.start_date)} → ${formatDate(a.end_date)}` : "—"}</TableCell>
            <TableCell label="Document">{a.file ? <a href={`/api/files/${a.file.id}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{a.file.name}</a> : <span className="text-xs text-muted-foreground">Not uploaded</span>}</TableCell>
            <TableCell actions className="pr-4">
              {canManage && (
                <RowActions editAs="dialog" editTitle="Edit agreement" edit={saveAgreement.bind(null, a.id) as FormAction} editForm={<AgreementFields a={a} clients={clients} projects={projects} />}
                  onDelete={() => deleteAgreement(a.id)} deleteTitle={`Delete “${a.title}”?`} deleteDescription="The agreement record will be removed. The uploaded document stays in Files." />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
