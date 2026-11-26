"use client";

import { TemplateField } from "@/features/finance/components/template-picker";
import { asTemplate, parseBankDetails } from "@/lib/doc-templates";
import { useState } from "react";
import { Building2, Hash, Landmark, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/app/password-input";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, Field, NativeSelect, SubmitButton } from "@/components/app/form";
import { INDIAN_STATES } from "@/lib/constants";
import type { CompanySettings } from "@/features/common/lookups";
import { changePassword, saveBilling, saveCompany, saveProfile } from "./actions";

export function CompanyForm({ s }: { s: CompanySettings | null }) {
  const bank = parseBankDetails(s?.bank_details);
  return (
    <ActionForm action={saveCompany} className="grid gap-4 sm:grid-cols-2">
      <Field name="company_name" label="Company name" required><Input name="company_name" defaultValue={s?.company_name ?? "Avora Brands"} /></Field>
      <Field name="legal_name" label="Legal name"><Input name="legal_name" defaultValue={s?.legal_name ?? ""} /></Field>
      <Field name="tagline" label="Tagline" className="sm:col-span-2"><Input name="tagline" defaultValue={s?.tagline ?? ""} /></Field>
      <Field name="address" label="Registered address" className="sm:col-span-2"><Textarea name="address" rows={2} defaultValue={s?.address ?? ""} /></Field>
      <Field name="state" label="State" hint="Determines CGST+SGST vs IGST suggestions"><NativeSelect name="state" defaultValue={s?.state ?? ""}><option value="">Select</option>{INDIAN_STATES.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Field>
      <Field name="gstin" label="GSTIN"><Input name="gstin" defaultValue={s?.gstin ?? ""} className="uppercase" /></Field>
      <Field name="pan" label="PAN"><Input name="pan" defaultValue={s?.pan ?? ""} className="uppercase" /></Field>
      <Field name="email" label="Billing email"><Input name="email" type="email" defaultValue={s?.email ?? ""} /></Field>
      <Field name="phone" label="Phone"><Input name="phone" defaultValue={s?.phone ?? ""} /></Field>
      <Field name="website" label="Website"><Input name="website" defaultValue={s?.website ?? ""} /></Field>
      <fieldset className="grid gap-3 sm:col-span-2">
        <legend className="mb-1.5 text-xs font-medium">Bank details <span className="font-normal text-muted-foreground">— printed on invoices</span></legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            { name: "bank_name", label: "Bank name", icon: Landmark, value: bank.bank, placeholder: "HDFC Bank, Vijayawada" },
            { name: "bank_account", label: "Account number", icon: Hash, value: bank.account, placeholder: "50200012345678", inputMode: "numeric" as const },
            { name: "bank_ifsc", label: "IFSC code", icon: Building2, value: bank.ifsc, placeholder: "HDFC0001234", upper: true },
          ]).map((f) => (
            <div key={f.name} className="relative rounded-xl border bg-muted/30 p-3">
              <f.icon aria-hidden className="absolute top-3 right-3 size-4 text-muted-foreground" />
              <Field name={f.name} label={f.label}>
                <Input name={f.name} defaultValue={f.value} placeholder={f.placeholder} inputMode={f.inputMode} autoComplete="off" className={f.upper ? "bg-background uppercase" : "bg-background"} />
              </Field>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end sm:col-span-2"><SubmitButton>Save company</SubmitButton></div>
    </ActionForm>
  );
}

export function BillingForm({ s }: { s: CompanySettings | null }) {
  const [rates, setRates] = useState(s?.tax_rates ?? [{ label: "GST 18%", rate: 18 }]);
  return (
    <ActionForm action={saveBilling} className="grid gap-5">
      <input type="hidden" name="tax_rates" value={JSON.stringify(rates)} />
      <Field name="tax_rates" label="Tax rates / GST slabs" hint="Each line item picks one of these. Different services can carry different rates.">
        <div className="space-y-2">
          {rates.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input value={r.label} onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="GST 18%" aria-label="Label" />
              <Input value={r.rate} onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, rate: Number(e.target.value) } : x)))} inputMode="decimal" className="w-24" aria-label="Rate %" />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove" disabled={rates.length === 1} onClick={() => setRates(rates.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setRates([...rates, { label: "", rate: 0 }])}><Plus /> Add rate</Button>
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field name="default_tax_rate" label="Default rate %"><Input name="default_tax_rate" defaultValue={s?.default_tax_rate ?? 18} inputMode="decimal" /></Field>
        <Field name="quotation_prefix" label="Quotation prefix"><Input name="quotation_prefix" defaultValue={s?.quotation_prefix ?? "QT"} /></Field>
        <Field name="invoice_prefix" label="Invoice prefix"><Input name="invoice_prefix" defaultValue={s?.invoice_prefix ?? "INV"} /></Field>
        <Field name="receipt_prefix" label="Receipt prefix"><Input name="receipt_prefix" defaultValue={s?.receipt_prefix ?? "RCPT"} /></Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Numbers look like INV-2026-0001 and restart each year. Changing a prefix only affects new documents.</p>
      <Field name="default_payment_terms" label="Default payment terms"><Textarea name="default_payment_terms" rows={2} defaultValue={s?.default_payment_terms ?? ""} /></Field>
      <Field name="default_terms" label="Default terms & conditions"><Textarea name="default_terms" rows={4} defaultValue={s?.default_terms ?? ""} /></Field>
      <Field label="Default quotation template" hint="Used for new quotations. Each quotation can still pick its own."><TemplateField name="quotation_template" defaultValue={asTemplate(s?.quotation_template)} /></Field>
      <Field label="Default invoice template" hint="Used for new invoices. Each invoice can still pick its own."><TemplateField name="invoice_template" defaultValue={asTemplate(s?.invoice_template)} /></Field>
      <div className="flex justify-end"><SubmitButton>Save billing settings</SubmitButton></div>
    </ActionForm>
  );
}

export function ProfileForms({ name, phone, email }: { name: string; phone: string | null; email: string }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <ActionForm action={saveProfile} className="grid gap-4">
        <p className="text-sm font-semibold">Your details</p>
        <Field name="full_name" label="Full name" required><Input name="full_name" defaultValue={name} /></Field>
        <Field name="phone" label="Phone"><Input name="phone" defaultValue={phone ?? ""} /></Field>
        <Field label="Email" hint="Contact an admin to change your sign-in email."><Input value={email} disabled /></Field>
        <div className="flex justify-end"><SubmitButton>Save profile</SubmitButton></div>
      </ActionForm>
      <ActionForm action={changePassword} className="grid gap-4" resetOnSuccess>
        <p className="text-sm font-semibold">Change password</p>
        <Field name="password" label="New password"><PasswordInput name="password" autoComplete="new-password" /></Field>
        <Field name="confirm" label="Confirm password"><PasswordInput name="confirm" autoComplete="new-password" /></Field>
        <div className="flex justify-end"><SubmitButton>Update password</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
