"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/app/form";
import { CLIENT_CATEGORIES, CLIENT_STATUS, INDIAN_STATES } from "@/lib/constants";
import type { Option } from "@/features/common/lookups";
import type { ClientRow } from "../queries";

export function ClientFields({ staff, client }: { staff: Option[]; client?: Partial<ClientRow> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="company_name" label="Company name" required className="sm:col-span-2"><Input name="company_name" defaultValue={client?.company_name ?? ""} autoFocus /></Field>
      <Field name="contact_person" label="Contact person"><Input name="contact_person" defaultValue={client?.contact_person ?? ""} /></Field>
      <Field name="phone" label="Phone"><Input name="phone" type="tel" defaultValue={client?.phone ?? ""} /></Field>
      <Field name="email" label="Email"><Input name="email" type="email" defaultValue={client?.email ?? ""} /></Field>
      <Field name="website" label="Website"><Input name="website" defaultValue={client?.website ?? ""} placeholder="example.com" /></Field>
      <Field name="billing_address" label="Billing address" className="sm:col-span-2"><Textarea name="billing_address" rows={2} defaultValue={client?.billing_address ?? ""} /></Field>
      <Field name="state" label="State" hint="Used to pick CGST+SGST vs IGST">
        <NativeSelect name="state" defaultValue={client?.state ?? ""}><option value="">Select state</option>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
      </Field>
      <Field name="gstin" label="GSTIN"><Input name="gstin" defaultValue={client?.gstin ?? ""} placeholder="29ABCDE1234F1Z5" className="uppercase" /></Field>
      <Field name="pan" label="PAN (optional)"><Input name="pan" defaultValue={client?.pan ?? ""} placeholder="ABCDE1234F" className="uppercase" /></Field>
      <Field name="category" label="Client category">
        <NativeSelect name="category" defaultValue={client?.category ?? ""}><option value="">Select category</option>{CLIENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
      </Field>
      <Field name="status" label="Status">
        <NativeSelect name="status" defaultValue={client?.status ?? "active"}>{CLIENT_STATUS.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
      </Field>
      <Field name="account_manager_id" label="Account manager">
        <NativeSelect name="account_manager_id" defaultValue={client?.account_manager_id ?? ""}><option value="">Unassigned</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</NativeSelect>
      </Field>
      <Field name="notes" label="Internal notes" hint="Never shown in the client portal." className="sm:col-span-2"><Textarea name="notes" rows={3} defaultValue={client?.notes ?? ""} /></Field>
    </div>
  );
}
