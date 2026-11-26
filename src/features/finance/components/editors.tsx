"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, Field, NativeSelect, SubmitButton, type FormAction } from "@/components/app/form";
import { Panel } from "@/components/app/panel";
import { suggestTaxMode, type LineItem, type TaxMode } from "@/lib/tax";
import { daysFromTodayISO } from "@/lib/format";
import type { Option } from "@/features/common/lookups";
import { LineItemsEditor } from "./line-items-editor";
import { TemplateField } from "./template-picker";
import type { DocTemplate } from "@/lib/doc-templates";

type Common = { action: FormAction; clients: (Option & { state?: string | null })[]; projects: (Option & { clientId: string })[]; taxRates: { label: string; rate: number }[]; defaultRate: number; companyState: string | null; cancelHref: string; items?: LineItem[]; defaultTemplate?: DocTemplate };

/** Picking a client suggests the GST treatment; it never touches the line items. */
function useClientTax(clients: Common["clients"], companyState: string | null, initialClient: string, savedMode?: TaxMode) {
  const suggest = (id: string) => suggestTaxMode(companyState, clients.find((c) => c.value === id)?.state);
  const [clientId, setClient] = useState(initialClient);
  const [mode, setMode] = useState<TaxMode>(() => savedMode ?? suggest(initialClient));
  const setClientId = (id: string) => { setClient(id); setMode(suggest(id)); };
  return { clientId, setClientId, mode, setMode };
}

export function QuotationEditor({ q, leads, ...p }: Common & { leads: Option[]; q?: { client_id: string | null; lead_id: string | null; project_id: string | null; title: string; description: string | null; issue_date: string; valid_until: string | null; tax_mode: TaxMode; payment_terms: string | null; terms: string | null; notes: string | null; template?: DocTemplate } }) {
  const { clientId, setClientId, mode, setMode } = useClientTax(p.clients, p.companyState, q?.client_id ?? "", q?.tax_mode);
  const today = daysFromTodayISO(0);
  const in30 = daysFromTodayISO(30);
  return (
    <ActionForm action={p.action} className="space-y-6">
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="title" label="Project title" required className="sm:col-span-2"><Input name="title" defaultValue={q?.title ?? ""} placeholder="Course brochure design — 34 programmes" /></Field>
          <Field name="client_id" label="Client" required>
            <NativeSelect name="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">{leads.length ? "— or choose a lead —" : "Choose client"}</option>{p.clients.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</NativeSelect>
          </Field>
          {leads.length > 0 && !clientId ? (
            <Field name="lead_id" label="Lead (not yet a client)"><NativeSelect name="lead_id" defaultValue={q?.lead_id ?? ""}><option value="">—</option>{leads.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</NativeSelect></Field>
          ) : <input type="hidden" name="lead_id" value={clientId ? "" : q?.lead_id ?? ""} />}
          <Field name="project_id" label="Project (optional)">
            <NativeSelect name="project_id" defaultValue={q?.project_id ?? ""}><option value="">—</option>{p.projects.filter((x) => !clientId || x.clientId === clientId).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</NativeSelect>
          </Field>
          <Field name="issue_date" label="Issue date" required><Input type="date" name="issue_date" defaultValue={q?.issue_date ?? today} /></Field>
          <Field name="valid_until" label="Valid until"><Input type="date" name="valid_until" defaultValue={q?.valid_until ?? in30} /></Field>
          <Field name="description" label="Scope / description" className="sm:col-span-2"><Textarea name="description" rows={3} defaultValue={q?.description ?? ""} /></Field>
        </div>
      </Panel>
      <Panel title="Line items"><LineItemsEditor initial={p.items} taxRates={p.taxRates} defaultRate={p.defaultRate} mode={mode} onModeChange={setMode} /></Panel>
      <Panel title="Terms">
        <div className="grid gap-4">
          <Field name="payment_terms" label="Payment terms"><Textarea name="payment_terms" rows={2} defaultValue={q?.payment_terms ?? ""} /></Field>
          <Field name="terms" label="Terms & conditions"><Textarea name="terms" rows={4} defaultValue={q?.terms ?? ""} /></Field>
          <Field name="notes" label="Internal notes" hint="Not printed on the PDF. Keep confidential remarks on the client profile — the client can access this record once sent."><Textarea name="notes" rows={2} defaultValue={q?.notes ?? ""} /></Field>
        </div>
      </Panel>
      <Panel title="PDF template" description="How the quotation looks when printed, saved as PDF or opened by the client. You can change it later."><TemplateField defaultValue={q?.template ?? p.defaultTemplate ?? "classic"} /></Panel>
      <div className="flex justify-end gap-2"><Button variant="outline" render={<Link href={p.cancelHref} />}>Cancel</Button><SubmitButton>Save quotation</SubmitButton></div>
    </ActionForm>
  );
}

export function InvoiceEditor({ inv, milestones, ...p }: Common & { milestones: (Option & { projectId: string })[]; inv?: { client_id: string; project_id: string | null; milestone_id: string | null; invoice_date: string; due_date: string; tax_mode: TaxMode; notes: string | null; terms: string | null; template?: DocTemplate }; defaultProjectId?: string }) {
  const { clientId, setClientId, mode, setMode } = useClientTax(p.clients, p.companyState, inv?.client_id ?? "", inv?.tax_mode);
  const [projectId, setProjectId] = useState(inv?.project_id ?? p.defaultProjectId ?? "");
  const today = daysFromTodayISO(0);
  const in15 = daysFromTodayISO(15);
  return (
    <ActionForm action={p.action} className="space-y-6">
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="client_id" label="Client" required>
            <NativeSelect name="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Choose client</option>{p.clients.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</NativeSelect>
          </Field>
          <Field name="project_id" label="Project">
            <NativeSelect name="project_id" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">—</option>{p.projects.filter((x) => !clientId || x.clientId === clientId).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</NativeSelect>
          </Field>
          <Field name="invoice_date" label="Invoice date" required><Input type="date" name="invoice_date" defaultValue={inv?.invoice_date ?? today} /></Field>
          <Field name="due_date" label="Due date" required><Input type="date" name="due_date" defaultValue={inv?.due_date ?? in15} /></Field>
          <Field name="milestone_id" label="Milestone (optional)" hint="For milestone billing" className="sm:col-span-2">
            <NativeSelect name="milestone_id" defaultValue={inv?.milestone_id ?? ""}><option value="">—</option>{milestones.filter((m) => m.projectId === projectId).map((m) => <option key={m.value} value={m.value}>{m.label}{m.sub ? ` · ${m.sub}` : ""}</option>)}</NativeSelect>
          </Field>
        </div>
      </Panel>
      <Panel title="Line items"><LineItemsEditor initial={p.items} taxRates={p.taxRates} defaultRate={p.defaultRate} mode={mode} onModeChange={setMode} showHsn /></Panel>
      <Panel title="Notes & terms">
        <div className="grid gap-4">
          <Field name="notes" label="Notes to client"><Textarea name="notes" rows={2} defaultValue={inv?.notes ?? ""} /></Field>
          <Field name="terms" label="Terms"><Textarea name="terms" rows={3} defaultValue={inv?.terms ?? ""} /></Field>
        </div>
      </Panel>
      <Panel title="PDF template" description="How the invoice looks when printed, saved as PDF or opened by the client. You can change it later."><TemplateField defaultValue={inv?.template ?? p.defaultTemplate ?? "classic"} /></Panel>
      <div className="flex justify-end gap-2"><Button variant="outline" render={<Link href={p.cancelHref} />}>Cancel</Button><SubmitButton>Save invoice</SubmitButton></div>
    </ActionForm>
  );
}
