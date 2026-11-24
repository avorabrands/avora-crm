import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { INVOICE_STATUS } from "@/lib/constants";
import { effectiveInvoiceStatus, formatDate, formatINR } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

export default async function PortalInvoices() {
  await requireClient();
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("id, number, invoice_date, due_date, status, total, balance_due").order("invoice_date", { ascending: false });
  return (
    <>
      <PageHeader title="Invoices" description="Download invoices and see what's outstanding. Payments are recorded by the Avora team once received." />
      <Panel bodyClassName="p-0">
        {(data ?? []).length === 0 ? <EmptyState icon={Receipt} title="No invoices yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead className="pl-4">Invoice</TableHead><TableHead>Date</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="pr-4 text-right">Balance</TableHead></TableRow></TableHeader>
            <TableBody>{(data ?? []).map((i) => (
              <TableRow key={i.id}>
                <TableCell className="pl-4"><Link href={`/portal/invoices/${i.id}`} className="font-medium hover:text-primary">{i.number}</Link></TableCell>
                <TableCell className="text-sm">{formatDate(i.invoice_date)}</TableCell><TableCell className="text-sm">{formatDate(i.due_date)}</TableCell>
                <TableCell><StatusBadge def={INVOICE_STATUS} value={effectiveInvoiceStatus(i)} /></TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(i.total)}</TableCell><TableCell className="pr-4 text-right font-medium tabular-nums">{formatINR(i.balance_due)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
