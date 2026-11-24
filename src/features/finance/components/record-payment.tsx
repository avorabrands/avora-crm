"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog, NativeSelect } from "@/components/app/form";
import { PAYMENT_METHOD, PAYMENT_TYPE } from "@/lib/constants";
import { formatINR, todayISO } from "@/lib/format";
import type { Option } from "@/features/common/lookups";
import { recordPayment } from "../invoice-actions";

type InvOpt = { value: string; label: string; balance: number; clientId: string };

export function RecordPaymentButton({ invoices, clients, fixedInvoice, label = "Record payment", variant = "default" }: { invoices: InvOpt[]; clients: Option[]; fixedInvoice?: InvOpt; label?: string; variant?: "default" | "outline" }) {
  const [inv, setInv] = useState(fixedInvoice?.value ?? "");
  const selected = fixedInvoice ?? invoices.find((i) => i.value === inv);
  return (
    <FormDialog openKey={fixedInvoice ? undefined : "payment"} trigger={<Button variant={variant}><Plus /> {label}</Button>} title="Record payment" description="Payments are recorded manually. Invoice balances and status update automatically." action={recordPayment} submitLabel="Record payment">
      {fixedInvoice ? <input type="hidden" name="invoice_id" value={fixedInvoice.value} /> : (
        <Field name="invoice_id" label="Invoice" hint="Leave empty to record an advance on account">
          <NativeSelect name="invoice_id" value={inv} onChange={(e) => setInv(e.target.value)}>
            <option value="">No invoice (advance on account)</option>
            {invoices.map((i) => <option key={i.value} value={i.value}>{i.label} · due {formatINR(i.balance)}</option>)}
          </NativeSelect>
        </Field>
      )}
      {!selected && (
        <Field name="client_id" label="Client" required>
          <NativeSelect name="client_id" defaultValue=""><option value="">Choose client</option>{clients.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</NativeSelect>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="amount" label="Amount received (₹)" required hint={selected ? `Outstanding: ${formatINR(selected.balance)}` : undefined}>
          <Input name="amount" inputMode="decimal" defaultValue={selected ? String(selected.balance) : ""} key={selected?.value ?? "none"} />
        </Field>
        <Field name="payment_date" label="Payment date" required><Input type="date" name="payment_date" defaultValue={todayISO()} /></Field>
        <Field name="method" label="Method"><NativeSelect name="method" defaultValue="bank_transfer">{PAYMENT_METHOD.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
        <Field name="payment_type" label="Type"><NativeSelect name="payment_type" defaultValue={selected ? "partial" : "advance"}>{PAYMENT_TYPE.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
        <Field name="transaction_id" label="Transaction ID / UTR"><Input name="transaction_id" /></Field>
        <Field name="reference_number" label="Reference no."><Input name="reference_number" /></Field>
      </div>
      <Field name="notes" label="Notes" hint="Shown on the receipt"><Textarea name="notes" rows={2} /></Field>
    </FormDialog>
  );
}
