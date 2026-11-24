import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";

export default async function PortalPayments() {
  await requireClient();
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("id, receipt_number, payment_date, amount, method, reference_number, transaction_id, invoice:invoices(number)").order("payment_date", { ascending: false });
  const rows = (data ?? []) as unknown as { id: string; receipt_number: string; payment_date: string; amount: number; method: string; reference_number: string | null; transaction_id: string | null; invoice: { number: string } | null }[];
  return (
    <>
      <PageHeader title="Payment history" description={`${rows.length} payments · ${formatINR(rows.reduce((a, p) => a + Number(p.amount), 0))} in total`} />
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? <EmptyState icon={Wallet} title="No payments recorded yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead className="pl-4">Receipt</TableHead><TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="pr-4 text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="pl-4"><Link href={`/print/receipt/${p.id}`} className="font-medium hover:text-primary">{p.receipt_number}</Link></TableCell>
                <TableCell label="Date" className="text-sm">{formatDate(p.payment_date)}</TableCell><TableCell label="Invoice" className="text-sm">{p.invoice?.number ?? "Advance"}</TableCell>
                <TableCell label="Method" className="text-sm">{PAYMENT_METHOD.label[p.method as keyof typeof PAYMENT_METHOD.label]}</TableCell>
                <TableCell label="Reference" className="text-xs text-muted-foreground">{p.transaction_id ?? p.reference_number ?? "—"}</TableCell>
                <TableCell label="Amount" className="pr-4 text-right font-medium tabular-nums">{formatINR(p.amount)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
