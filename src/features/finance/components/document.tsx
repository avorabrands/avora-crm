import Image from "next/image";
import { documentTotals, type TaxMode } from "@/lib/tax";
import { formatDate, formatINR } from "@/lib/format";
import { TAX_MODE } from "@/lib/constants";
import type { CompanySettings } from "@/features/common/lookups";
import type { ItemRow } from "../queries";
import { amountInWordsINR, type DocTemplate } from "@/lib/doc-templates";

type Party = { company_name: string; billing_address?: string | null; gstin?: string | null; state?: string | null; contact_person?: string | null; email?: string | null } | null;

type DocProps = {
  kind: "Quotation" | "Tax Invoice"; number: string; title?: string | null; company: CompanySettings | null; party: Party;
  meta: { label: string; value: string }[]; items: ItemRow[]; taxMode: string;
  totals: { subtotal: number; discount_total: number; tax_total: number; total: number; amount_paid?: number; balance_due?: number };
  footer?: React.ReactNode; notes?: string | null; terms?: string | null; paymentTerms?: string | null;
};

/** Printable quotation / invoice body in the chosen template. Totals come from the DB; the GST split is derived per slab. */
export function FinanceDocument({ template = "classic", ...p }: DocProps & { template?: DocTemplate }) {
  if (template === "modern") return <ModernLayout {...p} />;
  if (template === "professional") return <ProfessionalLayout {...p} />;
  return <ClassicLayout {...p} />;
}

/** The original layout — light, airy, purple accent. */
function ClassicLayout({ kind, number, title, company, party, meta, items, taxMode, totals, footer, notes, terms, paymentTerms }: DocProps) {
  const breakdown = documentTotals(items.map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount_pct: Number(i.discount_pct), tax_rate: Number(i.tax_rate) })), taxMode as TaxMode).breakdown;
  const showHsn = items.some((i) => i.hsn_sac);
  return (
    <article className="mx-auto max-w-4xl rounded-xl border bg-white p-4 text-[13px] sm:p-8 text-slate-800 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none dark:bg-white">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2"><Image src="/avora-logo.png" alt="" width={36} height={36} className="size-9 rounded-lg" /><p className="text-lg font-semibold text-slate-900">{company?.company_name ?? "Avora Brands"}</p></div>
          {company?.legal_name && <p className="mt-2 text-slate-600">{company.legal_name}</p>}
          {company?.address && <p className="max-w-xs whitespace-pre-wrap text-slate-600">{company.address}</p>}
          <p className="text-slate-600">{[company?.email, company?.phone].filter(Boolean).join(" · ")}</p>
          {company?.gstin && <p className="text-slate-600">GSTIN: {company.gstin}</p>}
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{kind}</p>
          <p className="font-medium text-[#7047EB]">{number}</p>
          <dl className="mt-3 space-y-0.5">{meta.map((m) => <div key={m.label} className="flex gap-3 sm:justify-end"><dt className="text-slate-500">{m.label}</dt><dd className="min-w-24 font-medium">{m.value}</dd></div>)}</dl>
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
      <table className="stack w-full border-collapse">
        <thead><tr className="border-y border-slate-200 bg-slate-50 text-left text-[11px] tracking-wider text-slate-500 uppercase">
          <th className="px-2 py-2 font-semibold">#</th><th className="px-2 py-2 font-semibold">Item</th>{showHsn && <th className="px-2 py-2 font-semibold">HSN/SAC</th>}
          <th className="px-2 py-2 text-right font-semibold">Qty</th><th className="px-2 py-2 text-right font-semibold">Rate</th><th className="px-2 py-2 text-right font-semibold">Disc.</th><th className="px-2 py-2 text-right font-semibold">GST</th><th className="px-2 py-2 text-right font-semibold">Amount</th>
        </tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id} className="border-b border-slate-100 align-top">
              <td className="m-hide px-2 py-2.5 text-slate-500">{i + 1}</td>
              <td data-title className="px-2 py-2.5"><p className="font-medium text-slate-900">{it.name}</p>{it.description && <p className="text-slate-500">{it.description}</p>}</td>
              {showHsn && <td data-label="HSN/SAC" className="px-2 py-2.5">{it.hsn_sac}</td>}
              <td data-label="Qty" className="px-2 py-2.5 text-right tabular-nums">{Number(it.quantity)}</td>
              <td data-label="Rate" className="px-2 py-2.5 text-right tabular-nums">{formatINR(it.unit_price)}</td>
              <td data-label="Discount" className="px-2 py-2.5 text-right tabular-nums">{Number(it.discount_pct) ? `${Number(it.discount_pct)}%` : "—"}</td>
              <td data-label="GST" className="px-2 py-2.5 text-right tabular-nums">{taxMode === "none" ? "—" : `${Number(it.tax_rate)}%`}</td>
              <td data-label="Amount" className="px-2 py-2.5 text-right font-medium tabular-nums">{formatINR(taxMode === "none" ? Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_pct) / 100) : it.line_total)}</td>
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

/** Shared maths for the newer layouts. */
function docNumbers(items: ItemRow[], taxMode: string) {
  const breakdown = documentTotals(items.map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount_pct: Number(i.discount_pct), tax_rate: Number(i.tax_rate) })), taxMode as TaxMode).breakdown;
  const taxable = (it: ItemRow) => Math.round(Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_pct) / 100) * 100) / 100;
  const amount = (it: ItemRow) => (taxMode === "none" ? taxable(it) : Number(it.line_total));
  return { breakdown, taxable, amount, showHsn: items.some((i) => i.hsn_sac), showDisc: items.some((i) => Number(i.discount_pct) > 0), taxed: taxMode !== "none" };
}

const ACCENT = "#7047EB";
const exact = "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]";

/** Bold colour header band, soft cards, highlighted total. */
function ModernLayout({ kind, number, title, company, party, meta, items, taxMode, totals, footer, notes, terms, paymentTerms }: DocProps) {
  const n = docNumbers(items, taxMode);
  const label = "text-[10px] font-semibold tracking-[0.14em] uppercase";
  return (
    <article className={`mx-auto max-w-4xl overflow-hidden rounded-2xl border bg-white text-[13px] text-slate-700 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none ${exact}`}>
      <header className="flex flex-wrap items-end justify-between gap-6 px-5 pt-6 pb-7 text-white sm:px-8 sm:pt-8" style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #4F2BC7 100%)` }}>
        <div className="flex items-center gap-3">
          <Image src="/avora-logo.png" alt="" width={48} height={48} className="size-12 rounded-xl bg-white p-1" />
          <div>
            <p className="text-xl font-semibold tracking-tight">{company?.company_name ?? "Avora Brands"}</p>
            {company?.tagline && <p className="text-[12px] text-white/75">{company.tagline}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className={`${label} text-white/70`}>{kind}</p>
          <p className="text-2xl font-semibold tracking-tight sm:text-3xl">{number}</p>
        </div>
      </header>

      <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
        <div className="bg-white px-5 py-5 sm:px-8">
          <p className={`${label} text-slate-400`}>From</p>
          <p className="mt-1.5 font-semibold text-slate-900">{company?.legal_name ?? company?.company_name ?? "Avora Brands"}</p>
          {company?.address && <p className="whitespace-pre-wrap text-slate-500">{company.address}</p>}
          {company?.phone && <p className="text-slate-500">{company.phone}</p>}
          {company?.email && <p className="break-all text-slate-500">{company.email}</p>}
          {company?.gstin && <p className="text-slate-500">GSTIN {company.gstin}</p>}
        </div>
        <div className="bg-white px-5 py-5 sm:px-8">
          <p className={`${label} text-slate-400`}>Billed to</p>
          <p className="mt-1.5 font-semibold text-slate-900">{party?.company_name ?? "—"}</p>
          {party?.contact_person && <p className="text-slate-500">Attn: {party.contact_person}</p>}
          {party?.billing_address && <p className="whitespace-pre-wrap text-slate-500">{party.billing_address}</p>}
          {party?.gstin && <p className="text-slate-500">GSTIN {party.gstin}</p>}
          {party?.state && <p className="text-slate-500">Place of supply: {party.state}</p>}
        </div>
        <dl className="space-y-2 bg-white px-5 py-5 sm:px-8">
          {meta.map((m) => <div key={m.label}><dt className={`${label} text-slate-400`}>{m.label}</dt><dd className="font-medium text-slate-900">{m.value}</dd></div>)}
        </dl>
      </div>

      <div className="px-5 pt-6 sm:px-8">
        {title && <div className="mb-5 rounded-xl px-4 py-3" style={{ background: "#F4F0FF" }}><p className={`${label}`} style={{ color: ACCENT }}>Subject</p><p className="mt-0.5 text-[15px] font-semibold text-slate-900">{title}</p></div>}
        <table className="stack w-full border-separate border-spacing-0">
          <thead><tr className="text-left text-[10px] tracking-[0.12em] text-white uppercase">
            <th className="rounded-l-lg px-3 py-2.5 font-semibold" style={{ background: ACCENT }}>Item</th>
            {n.showHsn && <th className="px-3 py-2.5 font-semibold" style={{ background: ACCENT }}>HSN/SAC</th>}
            <th className="px-3 py-2.5 text-right font-semibold" style={{ background: ACCENT }}>Qty</th>
            <th className="px-3 py-2.5 text-right font-semibold" style={{ background: ACCENT }}>Rate</th>
            {n.showDisc && <th className="px-3 py-2.5 text-right font-semibold" style={{ background: ACCENT }}>Disc.</th>}
            {n.taxed && <th className="px-3 py-2.5 text-right font-semibold" style={{ background: ACCENT }}>GST</th>}
            <th className="rounded-r-lg px-3 py-2.5 text-right font-semibold" style={{ background: ACCENT }}>Amount</th>
          </tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className={`align-top ${i % 2 ? "bg-slate-50/80" : ""}`}>
                <td data-title className="rounded-l-lg px-3 py-3"><p className="font-semibold text-slate-900">{it.name}</p>{it.description && <p className="text-slate-500">{it.description}</p>}</td>
                {n.showHsn && <td data-label="HSN/SAC" className="px-3 py-3">{it.hsn_sac}</td>}
                <td data-label="Qty" className="px-3 py-3 text-right tabular-nums">{Number(it.quantity)}</td>
                <td data-label="Rate" className="px-3 py-3 text-right tabular-nums">{formatINR(it.unit_price)}</td>
                {n.showDisc && <td data-label="Discount" className="px-3 py-3 text-right tabular-nums">{Number(it.discount_pct) ? `${Number(it.discount_pct)}%` : "—"}</td>}
                {n.taxed && <td data-label="GST" className="px-3 py-3 text-right tabular-nums">{Number(it.tax_rate)}%</td>}
                <td data-label="Amount" className="rounded-r-lg px-3 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatINR(n.amount(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="flex flex-col-reverse gap-6 px-5 py-6 sm:flex-row sm:justify-between sm:px-8">
        <div className="max-w-md space-y-4 text-slate-600">
          {paymentTerms && <div><p className={`${label} text-slate-400`}>Payment terms</p><p className="mt-1 whitespace-pre-wrap">{paymentTerms}</p></div>}
          {company?.bank_details && <div className="rounded-xl border border-dashed border-slate-300 p-3"><p className={`${label} text-slate-400`}>Pay to</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{company.bank_details}</p></div>}
          {notes && <div><p className={`${label} text-slate-400`}>Notes</p><p className="mt-1 whitespace-pre-wrap">{notes}</p></div>}
        </div>
        <div className="w-full sm:w-80">
          <dl className="space-y-1.5 px-1">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{formatINR(totals.subtotal)}</dd></div>
            {Number(totals.discount_total) > 0 && <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="tabular-nums">− {formatINR(totals.discount_total)}</dd></div>}
            {Number(totals.discount_total) > 0 && <div className="flex justify-between"><dt className="text-slate-500">Taxable value</dt><dd className="tabular-nums">{formatINR(Number(totals.subtotal) - Number(totals.discount_total))}</dd></div>}
            {n.breakdown.map((b) => <div key={b.label} className="flex justify-between"><dt className="text-slate-500">{b.label}</dt><dd className="tabular-nums">{formatINR(b.amount)}</dd></div>)}
          </dl>
          <div className="mt-3 flex items-center justify-between rounded-xl px-4 py-3 text-white" style={{ background: ACCENT }}>
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">Total</span>
            <span className="text-xl font-semibold tabular-nums">{formatINR(totals.total)}</span>
          </div>
          {totals.amount_paid !== undefined && Number(totals.amount_paid) > 0 && <div className="mt-2 flex justify-between px-1 text-emerald-700"><span>Paid</span><span className="tabular-nums">− {formatINR(totals.amount_paid)}</span></div>}
          {totals.balance_due !== undefined && <div className="mt-1 flex justify-between px-1 font-semibold text-slate-900"><span>Balance due</span><span className="tabular-nums">{formatINR(totals.balance_due)}</span></div>}
          <p className="pt-2 text-right text-[11px] text-slate-400">{TAX_MODE.label[taxMode as keyof typeof TAX_MODE.label]}</p>
        </div>
      </section>

      {terms && <section className="mx-5 border-t border-slate-200 pt-4 text-[12px] text-slate-500 sm:mx-8"><p className={`${label} text-slate-400`}>Terms & conditions</p><p className="mt-1 whitespace-pre-wrap">{terms}</p></section>}
      {footer}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-[11px] text-slate-500 sm:px-8" style={{ background: "#F4F0FF" }}>
        <span>Thank you for your business.</span>
        <span>{[company?.website, company?.email].filter(Boolean).join(" · ")}</span>
      </footer>
    </article>
  );
}

/** Formal boxed GST layout: bordered grid, amount in words, signatory block. */
function ProfessionalLayout({ kind, number, title, company, party, meta, items, taxMode, totals, footer, notes, terms, paymentTerms }: DocProps) {
  const n = docNumbers(items, taxMode);
  const cell = "border border-slate-400 px-2 py-1.5";
  const head = "text-[10px] font-bold tracking-wider text-slate-700 uppercase";
  const isInvoice = kind === "Tax Invoice";
  return (
    <article className={`mx-auto max-w-4xl bg-white p-3 text-[12px] text-slate-800 shadow-sm sm:p-6 print:max-w-none print:p-0 print:shadow-none ${exact}`}>
      <div className="border-2 border-slate-700">
        <div className="flex items-center justify-between border-b-2 border-slate-700 bg-slate-100 px-3 py-2 max-sm:justify-center">
          <span className="w-24 text-[10px] text-slate-500 max-sm:hidden">{isInvoice ? "Original for recipient" : ""}</span>
          <h1 className="text-base font-bold tracking-[0.2em] whitespace-nowrap text-slate-900 uppercase">{kind}</h1>
          <span className="w-24 text-right text-[10px] text-slate-500 max-sm:hidden">{TAX_MODE.label[taxMode as keyof typeof TAX_MODE.label]}</span>
        </div>

        <div className="grid sm:grid-cols-[1.4fr_1fr]">
          <div className="flex gap-3 border-b border-slate-400 p-3 sm:border-r">
            <Image src="/avora-logo.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded" />
            <div>
              <p className="text-[15px] font-bold text-slate-900">{company?.legal_name ?? company?.company_name ?? "Avora Brands"}</p>
              {company?.address && <p className="whitespace-pre-wrap">{company.address}</p>}
              {company?.phone && <p>{company.phone}</p>}
              {company?.email && <p className="break-all">{company.email}</p>}
              {company?.gstin && <p><span className="font-semibold">GSTIN:</span> {company.gstin}</p>}
              {company?.pan && <p><span className="font-semibold">PAN:</span> {company.pan}</p>}
            </div>
          </div>
          <table className="w-full border-collapse border-b border-slate-400 text-[12px]">
            <tbody>
              <tr><td className="border-b border-slate-300 px-3 py-1.5 font-semibold">{isInvoice ? "Invoice no." : "Quotation no."}</td><td className="border-b border-slate-300 px-3 py-1.5 font-bold text-slate-900">{number}</td></tr>
              {meta.map((m) => <tr key={m.label}><td className="border-b border-slate-300 px-3 py-1.5 font-semibold">{m.label}</td><td className="border-b border-slate-300 px-3 py-1.5">{m.value}</td></tr>)}
              {party?.state && <tr><td className="px-3 py-1.5 font-semibold">Place of supply</td><td className="px-3 py-1.5">{party.state}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-[1.4fr_1fr]">
          <div className="border-b border-slate-400 p-3 sm:border-r">
            <p className={head}>{isInvoice ? "Bill to" : "Prepared for"}</p>
            <p className="mt-1 text-[13px] font-bold text-slate-900">{party?.company_name ?? "—"}</p>
            {party?.contact_person && <p>Kind attn: {party.contact_person}</p>}
            {party?.billing_address && <p className="whitespace-pre-wrap">{party.billing_address}</p>}
            {party?.gstin && <p><span className="font-semibold">GSTIN:</span> {party.gstin}</p>}
          </div>
          <div className="border-b border-slate-400 p-3">
            <p className={head}>Subject</p>
            <p className="mt-1 font-medium text-slate-900">{title || "—"}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead><tr className="bg-slate-100 text-left">
              <th className={`${cell} ${head} w-10 border-l-0 text-center`}>S.No</th>
              <th className={`${cell} ${head}`}>Description</th>
              {n.showHsn && <th className={`${cell} ${head}`}>HSN/SAC</th>}
              <th className={`${cell} ${head} text-right`}>Qty</th>
              <th className={`${cell} ${head} text-right`}>Rate</th>
              {n.showDisc && <th className={`${cell} ${head} text-right`}>Disc.</th>}
              <th className={`${cell} ${head} text-right`}>Taxable</th>
              {n.taxed && <th className={`${cell} ${head} text-right`}>GST</th>}
              <th className={`${cell} ${head} border-r-0 text-right`}>Amount (₹)</th>
            </tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="align-top">
                  <td className={`${cell} border-l-0 text-center`}>{i + 1}</td>
                  <td className={cell}><p className="font-semibold text-slate-900">{it.name}</p>{it.description && <p className="text-slate-600">{it.description}</p>}</td>
                  {n.showHsn && <td className={cell}>{it.hsn_sac}</td>}
                  <td className={`${cell} text-right tabular-nums`}>{Number(it.quantity)}</td>
                  <td className={`${cell} text-right tabular-nums`}>{formatINR(it.unit_price)}</td>
                  {n.showDisc && <td className={`${cell} text-right tabular-nums`}>{Number(it.discount_pct) ? `${Number(it.discount_pct)}%` : "—"}</td>}
                  <td className={`${cell} text-right tabular-nums`}>{formatINR(n.taxable(it))}</td>
                  {n.taxed && <td className={`${cell} text-right tabular-nums`}>{Number(it.tax_rate)}%</td>}
                  <td className={`${cell} border-r-0 text-right font-semibold tabular-nums`}>{formatINR(n.amount(it))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3 border-b border-slate-400 p-3 sm:border-r">
            <div><p className={head}>Amount in words</p><p className="mt-0.5 font-semibold text-slate-900 italic">{amountInWordsINR(totals.total)}</p></div>
            {paymentTerms && <div><p className={head}>Payment terms</p><p className="whitespace-pre-wrap">{paymentTerms}</p></div>}
            {company?.bank_details && <div><p className={head}>Bank details</p><p className="whitespace-pre-wrap">{company.bank_details}</p></div>}
            {notes && <div><p className={head}>Notes</p><p className="whitespace-pre-wrap">{notes}</p></div>}
          </div>
          <table className="w-full border-collapse self-start border-b border-slate-400">
            <tbody>
              <tr><td className="border-b border-slate-300 px-3 py-1.5">Subtotal</td><td className="border-b border-slate-300 px-3 py-1.5 text-right tabular-nums">{formatINR(totals.subtotal)}</td></tr>
              {Number(totals.discount_total) > 0 && <tr><td className="border-b border-slate-300 px-3 py-1.5">Less: discount</td><td className="border-b border-slate-300 px-3 py-1.5 text-right tabular-nums">− {formatINR(totals.discount_total)}</td></tr>}
              <tr><td className="border-b border-slate-300 px-3 py-1.5">Taxable value</td><td className="border-b border-slate-300 px-3 py-1.5 text-right tabular-nums">{formatINR(Number(totals.subtotal) - Number(totals.discount_total))}</td></tr>
              {n.breakdown.map((b) => <tr key={b.label}><td className="border-b border-slate-300 px-3 py-1.5">{b.label}</td><td className="border-b border-slate-300 px-3 py-1.5 text-right tabular-nums">{formatINR(b.amount)}</td></tr>)}
              <tr className="bg-slate-100 text-[13px] font-bold text-slate-900"><td className="px-3 py-2">Grand total</td><td className="px-3 py-2 text-right tabular-nums">{formatINR(totals.total)}</td></tr>
              {totals.amount_paid !== undefined && Number(totals.amount_paid) > 0 && <tr><td className="border-t border-slate-300 px-3 py-1.5">Amount received</td><td className="border-t border-slate-300 px-3 py-1.5 text-right tabular-nums">− {formatINR(totals.amount_paid)}</td></tr>}
              {totals.balance_due !== undefined && <tr className="font-bold"><td className="border-t border-slate-300 px-3 py-1.5">Balance due</td><td className="border-t border-slate-300 px-3 py-1.5 text-right tabular-nums">{formatINR(totals.balance_due)}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-[1.4fr_1fr]">
          <div className="p-3 text-[11px] text-slate-600 sm:border-r sm:border-slate-400">
            {terms && <><p className={head}>Terms & conditions</p><p className="mt-0.5 whitespace-pre-wrap">{terms}</p></>}
          </div>
          <div className="flex min-h-28 flex-col justify-between p-3 text-right">
            <p className="font-semibold">For {company?.legal_name ?? company?.company_name ?? "Avora Brands"}</p>
            <p className="border-t border-slate-400 pt-1 text-[11px] text-slate-600">Authorised signatory</p>
          </div>
        </div>
      </div>
      {footer}
      <p className="mt-3 text-center text-[10px] text-slate-400">This is a computer-generated {isInvoice ? "invoice" : "quotation"}.</p>
    </article>
  );
}

export function ReceiptDocument({ company, payment }: { company: CompanySettings | null; payment: { receipt_number: string; payment_date: string; amount: number; method: string; payment_type: string; transaction_id: string | null; reference_number: string | null; notes: string | null; client: Party; invoice: { number: string } | null } }) {
  return (
    <article className="mx-auto max-w-2xl rounded-xl border bg-white p-4 text-[13px] sm:p-8 text-slate-800 shadow-sm print:border-0 print:p-0 print:shadow-none">
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
