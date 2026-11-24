// Mirrors the generated columns on quotation_items / invoice_items so the
// editor preview matches what the database stores.
export type LineItem = { name: string; description?: string | null; hsn_sac?: string | null; quantity: number; unit_price: number; discount_pct: number; tax_rate: number };
export type TaxMode = "intra_state" | "inter_state" | "none";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineAmounts(i: LineItem) {
  const subtotal = r2(i.quantity * i.unit_price);
  const discount = r2(i.quantity * i.unit_price * i.discount_pct / 100);
  const tax = r2(i.quantity * i.unit_price * (1 - i.discount_pct / 100) * i.tax_rate / 100);
  return { subtotal, discount, taxable: r2(subtotal - discount), tax, total: r2(subtotal - discount + tax) };
}

export function documentTotals(items: LineItem[], mode: TaxMode) {
  let subtotal = 0, discount = 0, tax = 0;
  const byRate = new Map<number, { taxable: number; tax: number }>();
  for (const it of items) {
    const a = lineAmounts(it);
    subtotal += a.subtotal; discount += a.discount; tax += a.tax;
    if (it.tax_rate > 0) {
      const b = byRate.get(it.tax_rate) ?? { taxable: 0, tax: 0 };
      b.taxable += a.taxable; b.tax += a.tax; byRate.set(it.tax_rate, b);
    }
  }
  if (mode === "none") { tax = 0; byRate.clear(); }
  // GST breakdown: intra-state splits each slab into CGST + SGST halves
  const breakdown = [...byRate.entries()].sort((a, b) => a[0] - b[0]).flatMap(([rate, b]) =>
    mode === "intra_state"
      ? [{ label: `CGST @ ${rate / 2}%`, amount: r2(b.tax / 2) }, { label: `SGST @ ${rate / 2}%`, amount: r2(b.tax - r2(b.tax / 2)) }]
      : [{ label: `IGST @ ${rate}%`, amount: r2(b.tax) }]);
  return { subtotal: r2(subtotal), discount: r2(discount), tax: r2(tax), total: r2(subtotal - discount + tax), breakdown };
}
