import { documentTotals, type TaxMode } from "@/lib/tax";
import { formatDate, formatINR } from "@/lib/format";
import { TAX_MODE } from "@/lib/constants";
import type { CompanySettings } from "@/features/common/lookups";
import type { ItemRow } from "../queries";

type Party = { company_name: string; billing_address?: string | null; gstin?: string | null; state?: string | null; contact_person?: string | null; email?: string | null } | null;

/** Printable quotation / invoice body. Totals come from the DB; the GST split is derived per slab. */
export function FinanceDocument({ kind, number, title, company, party, meta, items, taxMode, totals, footer, notes, terms, paymentTerms }: {
  kind: "Quotation" | "Tax Invoice"; number: string; title?: string | null; company: CompanySettings | null; party: Party;
  meta: { label: string; value: string }[]; items: ItemRow[]; taxMode: string;
  totals: { subtotal: number; discount_total: number; tax_total: number; total: number; amount_paid?: number; balance_due?: number };
  footer?: React.ReactNode; notes?: string | null; terms?: string | null; paymentTerms?: string | null;
}) {
  const breakdown = documentTotals(items.map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount_pct: Number(i.discount_pct), tax_rate: Number(i.tax_rate) })), taxMode as TaxMode).breakdown;
  const showHsn = items.some((i) => i.hsn_sac);
  return (
    <article className="mx-auto max-w-4xl rounded-xl border bg-white p-8 text-[13px] text-slate-800 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none dark:bg-white">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2"><div className="flex size-9 items-center justify-center rounded-lg bg-[#7047EB] font-bold text-white">A</div><p className="text-lg font-semibold text-slate-900">{company?.company_name ?? "Avora Brands"}</p></div>
          {company?.legal_name && <p className="mt-2 text-slate-600">{company.legal_name}</p>}
          {company?.address && <p className="max-w-xs whitespace-pre-wrap text-slate-600">{company.address}</p>}
          <p className="text-slate-600">{[company?.email, company?.phone].filter(Boolean).join(" · ")}</p>
          {company?.gstin && <p className="text-slate-600">GSTIN: {company.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{kind}</p>
          <p className="font-medium text-[#7047EB]">{number}</p>
          <dl className="mt-3 space-y-0.5">{meta.map((m) => <div key={m.label} className="flex justify-end gap-3"><dt className="text-slate-500">{m.label}</dt><dd className="min-w-24 font-medium">{m.value}</dd></div>)}</dl>
        </div>
      </header>
      <section className="grid gap-6 py-6 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Bill to</p>
          <p className="mt-1 font-semibold text-slate-900">{party?.company_name ?? "—"}</p>
          {party?.contact_person && <p>Attn: {party.contact_person}</p>}
          {party?.billing_address && <p className="whitespace-pre-wrap text-slate-600">{party.billing_address}</p>}
          {party?.gstin && <p className="text-slate-600">GSTIN: {party.gstin}</p>}
          {party?.state && <p className="text-slate-600">Place of supply: {party.state}</p>}
        </div>
        {title && <div><p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Subject</p><p className="mt-1 font-medium text-slate-900">{title}</p></div>}
      </section>
      <table className="w-full border-collapse">
        <thead><tr className="border-y border-slate-200 bg-slate-50 text-left text-[11px] tracking-wider text-slate-500 uppercase">
          <th className="px-2 py-2 font-semibold">#</th><th className="px-2 py-2 font-semibold">Item</th>{showHsn && <th className="px-2 py-2 font-semibold">HSN/SAC</th>}
          <th className="px-2 py-2 text-right font-semibold">Qty</th><th className="px-2 py-2 text-right font-semibold">Rate</th><th className="px-2 py-2 text-right font-semibold">Disc.</th><th className="px-2 py-2 text-right font-semibold">GST</th><th className="px-2 py-2 text-right font-semibold">Amount</th>
        </tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id} className="border-b border-slate-100 align-top">
              <td className="px-2 py-2.5 text-slate-500">{i + 1}</td>
              <td className="px-2 py-2.5"><p className="font-medium text-slate-900">{it.name}</p>{it.description && <p className="text-slate-500">{it.description}</p>}</td>
              {showHsn && <td className="px-2 py-2.5">{it.hsn_sac}</td>}
              <td className="px-2 py-2.5 text-right tabular-nums">{Number(it.quantity)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{formatINR(it.unit_price)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{Number(it.discount_pct) ? `${Number(it.discount_pct)}%` : "—"}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{taxMode === "none" ? "—" : `${Number(it.tax_rate)}%`}</td>
              <td className="px-2 py-2.5 text-right font-medium tabular-nums">{formatINR(taxMode === "none" ? Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_pct) / 100) : it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="mt-6 flex flex-col-reverse gap-6 sm:flex-row sm:justify-between">
        <div className="max-w-md space-y-4 text-slate-600">
          {paymentTerms && <div><p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Payment terms</p><p className="whitespace-pre-wrap">{paymentTerms}</p></div>}
          {company?.bank_details && <div><p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Bank details</p><p className="whitespace-pre-wrap">{company.bank_details}</p></div>}
          {notes && <div><p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Notes</p><p className="whitespace-pre-wrap">{notes}</p></div>}
        </div>
        <dl className="w-full space-y-1.5 sm:w-72">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{formatINR(totals.subtotal)}</dd></div>
          {Number(totals.discount_total) > 0 && <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="tabular-nums">− {formatINR(totals.discount_total)}</dd></div>}
          {Number(totals.discount_total) > 0 && <div className="flex justify-between"><dt className="text-slate-500">Taxable value</dt><dd className="tabular-nums">{formatINR(Number(totals.subtotal) - Number(totals.discount_total))}</dd></div>}
          {breakdown.map((b) => <div key={b.label} className="flex justify-between"><dt className="text-slate-500">{b.label}</dt><dd className="tabular-nums">{formatINR(b.amount)}</dd></div>)}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900"><dt>Total</dt><dd className="tabular-nums">{formatINR(totals.total)}</dd></div>
          {totals.amount_paid !== undefined && Number(totals.amount_paid) > 0 && <div className="flex justify-between text-emerald-700"><dt>Paid</dt><dd className="tabular-nums">− {formatINR(totals.amount_paid)}</dd></div>}
          {totals.balance_due !== undefined && <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd className="tabular-nums">{formatINR(totals.balance_due)}</dd></div>}
          <p className="pt-1 text-right text-[11px] text-slate-400">{TAX_MODE.label[taxMode as keyof typeof TAX_MODE.label]}</p>
        </dl>
      </section>
      {terms && <section className="mt-8 border-t border-slate-200 pt-4 text-[12px] text-slate-500"><p className="text-[11px] font-semibold tracking-wider uppercase">Terms & conditions</p><p className="mt-1 whitespace-pre-wrap">{terms}</p></section>}
      {footer}
      <p className="mt-10 text-center text-[11px] text-slate-400">{company?.tagline ?? "One Workspace. Every Client. Every Project."}</p>
    </article>
  );
}

export function ReceiptDocument({ company, payment }: { company: CompanySettings | null; payment: { receipt_number: string; payment_date: string; amount: number; method: string; payment_type: string; transaction_id: string | null; reference_number: string | null; notes: string | null; client: Party; invoice: { number: string } | null } }) {
  return (
    <article className="mx-auto max-w-2xl rounded-xl border bg-white p-8 text-[13px] text-slate-800 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between border-b border-slate-200 pb-5">
        <div><p className="text-lg font-semibold text-slate-900">{company?.company_name ?? "Avora Brands"}</p>{company?.gstin && <p className="text-slate-600">GSTIN: {company.gstin}</p>}<p className="text-slate-600">{company?.address}</p></div>
        <div className="text-right"><p className="text-xl font-semibold text-slate-900">Payment receipt</p><p className="font-medium text-[#7047EB]">{payment.receipt_number}</p><p className="text-slate-500">{formatDate(payment.payment_date)}</p></div>
      </header>
      <p className="py-6 text-base">Received with thanks from <strong>{payment.client?.company_name}</strong> the sum of <strong>{formatINR(payment.amount)}</strong>{payment.invoice ? <> against invoice <strong>{payment.invoice.number}</strong></> : " on account"}.</p>
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4">
        <div><dt className="text-slate-500">Payment method</dt><dd className="font-medium capitalize">{payment.method.replace("_", " ")}</dd></div>
        <div><dt className="text-slate-500">Payment type</dt><dd className="font-medium capitalize">{payment.payment_type}</dd></div>
        <div><dt className="text-slate-500">Transaction ID</dt><dd className="font-medium">{payment.transaction_id ?? "—"}</dd></div>
        <div><dt className="text-slate-500">Reference</dt><dd className="font-medium">{payment.reference_number ?? "—"}</dd></div>
      </dl>
      {payment.notes && <p className="mt-4 text-slate-600">{payment.notes}</p>}
      <p className="mt-12 text-right text-slate-500">For {company?.company_name ?? "Avora Brands"}</p>
      <p className="mt-8 text-center text-[11px] text-slate-400">This is a computer-generated receipt.</p>
    </article>
  );
}
