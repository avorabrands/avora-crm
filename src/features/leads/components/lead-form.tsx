"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/app/form";
import { LEAD_SOURCES, LEAD_STATUS, SERVICES } from "@/lib/constants";
import type { Option } from "@/features/common/lookups";
import type { LeadRow } from "../queries";

export function LeadFields({ staff, lead }: { staff: Option[]; lead?: Partial<LeadRow> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="company_name" label="Company name" required className="sm:col-span-2"><Input name="company_name" defaultValue={lead?.company_name ?? ""} autoFocus /></Field>
      <Field name="contact_person" label="Contact person"><Input name="contact_person" defaultValue={lead?.contact_person ?? ""} /></Field>
      <Field name="phone" label="Phone"><Input name="phone" type="tel" defaultValue={lead?.phone ?? ""} placeholder="+91 98450 00000" /></Field>
      <Field name="email" label="Email"><Input name="email" type="email" defaultValue={lead?.email ?? ""} /></Field>
      <Field name="location" label="Location"><Input name="location" defaultValue={lead?.location ?? ""} placeholder="Bengaluru" /></Field>
      <Field name="source" label="Lead source">
        <NativeSelect name="source" defaultValue={lead?.source ?? ""}>
          <option value="">Select source</option>
          {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
        </NativeSelect>
      </Field>
      <Field name="estimated_budget" label="Estimated budget (₹)"><Input name="estimated_budget" inputMode="decimal" defaultValue={lead?.estimated_budget ?? ""} /></Field>
      <Field name="assigned_to" label="Assigned to">
        <NativeSelect name="assigned_to" defaultValue={lead?.assigned_to ?? ""}>
          <option value="">Unassigned</option>
          {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </NativeSelect>
      </Field>
      <Field name="status" label="Status">
        <NativeSelect name="status" defaultValue={lead?.status ?? "new"}>
          {LEAD_STATUS.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </Field>
      <Field name="next_follow_up" label="Next follow-up"><Input name="next_follow_up" type="date" defaultValue={lead?.next_follow_up ?? ""} /></Field>
      <Field label="Required services" className="sm:col-span-2">
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground">
              <input type="checkbox" name="services[]" value={s} defaultChecked={lead?.services?.includes(s)} className="sr-only" />
              {s}
            </label>
          ))}
        </div>
      </Field>
      <Field name="notes" label="Notes" className="sm:col-span-2"><Textarea name="notes" rows={3} defaultValue={lead?.notes ?? ""} /></Field>
    </div>
  );
}
