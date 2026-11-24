"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/app/form";
import { documentTotals, lineAmounts, type LineItem, type TaxMode } from "@/lib/tax";
import { formatINR } from "@/lib/format";
import { TAX_MODE } from "@/lib/constants";

type Row = { key: number; name: string; description: string; hsn_sac: string; quantity: string; unit_price: string; discount_pct: string; tax_rate: string };

let seq = 0;
const blank = (rate: number): Row => ({ key: ++seq, name: "", description: "", hsn_sac: "", quantity: "1", unit_price: "", discount_pct: "0", tax_rate: String(rate) });
const toItem = (r: Row): LineItem => ({ name: r.name, description: r.description, hsn_sac: r.hsn_sac, quantity: Number(r.quantity) || 0, unit_price: Number(r.unit_price) || 0, discount_pct: Number(r.discount_pct) || 0, tax_rate: Number(r.tax_rate) || 0 });

/** Line items with GST preview. Serialises to a hidden `items` JSON field. */
export function LineItemsEditor({ initial, taxRates, defaultRate, initialMode, showHsn = false }: {
  initial?: LineItem[]; taxRates: { label: string; rate: number }[]; defaultRate: number; initialMode: TaxMode; showHsn?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.length ? initial.map((i) => ({ key: ++seq, name: i.name, description: i.description ?? "", hsn_sac: i.hsn_sac ?? "", quantity: String(i.quantity), unit_price: String(i.unit_price), discount_pct: String(i.discount_pct), tax_rate: String(i.tax_rate) })) : [blank(defaultRate)]);
  const [mode, setMode] = useState<TaxMode>(initialMode);
  const items = rows.filter((r) => r.name.trim()).map(toItem);
  const totals = useMemo(() => documentTotals(items, mode), [items, mode]);
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const rates = taxRates.some((t) => t.rate === defaultRate) ? taxRates : [...taxRates, { label: `GST ${defaultRate}%`, rate: defaultRate }];

  return (
    <div className="space-y-3">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <Field name="items" label="Line items" required>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Item</th>
                {showHsn && <th className="w-24 px-2 py-2 text-left font-medium">HSN/SAC</th>}
                <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
                <th className="w-32 px-2 py-2 text-right font-medium">Unit price</th>
                <th className="w-20 px-2 py-2 text-right font-medium">Disc %</th>
                <th className="w-32 px-2 py-2 text-left font-medium">Tax</th>
                <th className="w-28 px-2 py-2 text-right font-medium">Amount</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const a = lineAmounts(toItem(r));
                return (
                  <tr key={r.key} className="border-t align-top">
                    <td className="space-y-1 px-2 py-2">
                      <Input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} placeholder="e.g. Course brochure design" aria-label="Item name" />
                      <Input value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} placeholder="Description (optional)" className="h-7 text-xs" aria-label="Item description" />
                    </td>
                    {showHsn && <td className="px-2 py-2"><Input value={r.hsn_sac} onChange={(e) => update(r.key, { hsn_sac: e.target.value })} placeholder="998391" aria-label="HSN/SAC" /></td>}
                    <td className="px-2 py-2"><Input value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} inputMode="decimal" className="text-right" aria-label="Quantity" /></td>
                    <td className="px-2 py-2"><Input value={r.unit_price} onChange={(e) => update(r.key, { unit_price: e.target.value })} inputMode="decimal" className="text-right" placeholder="0" aria-label="Unit price" /></td>
                    <td className="px-2 py-2"><Input value={r.discount_pct} onChange={(e) => update(r.key, { discount_pct: e.target.value })} inputMode="decimal" className="text-right" aria-label="Discount percent" /></td>
                    <td className="px-2 py-2">
                      <select className="field-select" value={r.tax_rate} onChange={(e) => update(r.key, { tax_rate: e.target.value })} aria-label="Tax rate">
                        {rates.map((t) => <option key={t.rate} value={t.rate}>{t.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{formatINR(a.total)}</td>
                    <td className="px-1 py-2">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><Trash2 /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Field>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blank(defaultRate)])}><Plus /> Add line</Button>
          <Field name="tax_mode" label="GST treatment" className="w-56">
            <NativeSelect name="tax_mode" value={mode} onChange={(e) => setMode(e.target.value as TaxMode)}>
              {TAX_MODE.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <TotalsBox totals={totals} />
      </div>
    </div>
  );
}

export function TotalsBox({ totals }: { totals: ReturnType<typeof documentTotals> }) {
  return (
    <dl className="w-full space-y-1.5 rounded-lg bg-muted/50 p-4 text-sm sm:w-72">
      <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatINR(totals.subtotal)}</dd></div>
      {totals.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">− {formatINR(totals.discount)}</dd></div>}
      {totals.breakdown.map((b) => <div key={b.label} className="flex justify-between"><dt className="text-muted-foreground">{b.label}</dt><dd className="tabular-nums">{formatINR(b.amount)}</dd></div>)}
      <div className="flex justify-between border-t pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(totals.total)}</dd></div>
    </dl>
  );
}
