import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { SortHeader } from "@/components/app/table-controls";
import { INVOICE_STATUS, PAYMENT_METHOD, PAYMENT_TYPE, QUOTATION_STATUS } from "@/lib/constants";
import { effectiveInvoiceStatus, formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceRow, PaymentRow, QuotationRow } from "../queries";

const S = ({ s, col, children, dir }: { s: boolean; col: string; children: React.ReactNode; dir?: "asc" | "desc" }) => (s ? <SortHeader column={col} defaultDir={dir}>{children}</SortHeader> : <>{children}</>);

export function QuotationsTable({ rows, sortable = true, hrefBase = "/quotations" }: { rows: QuotationRow[]; sortable?: boolean; hrefBase?: string }) {
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead className="pl-4"><S s={sortable} col="number">Number</S></TableHead>
        <TableHead>Client</TableHead>
        <TableHead><S s={sortable} col="issue_date">Issued</S></TableHead>
        <TableHead>Valid until</TableHead>
        <TableHead><S s={sortable} col="status">Status</S></TableHead>
        <TableHead className="pr-4 text-right"><S s={sortable} col="total" dir="desc">Total</S></TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((q) => (
          <TableRow key={q.id}>
            <TableCell className="pl-4"><Link href={`${hrefBase}/${q.id}`} className="font-medium hover:text-primary">{q.number}</Link><p className="max-w-64 truncate text-xs text-muted-foreground">{q.title}</p></TableCell>
            <TableCell label="Client">{q.client?.company_name ?? (q.lead ? <span>{q.lead.company_name} <span className="text-xs text-muted-foreground">(lead)</span></span> : "—")}</TableCell>
            <TableCell label="Issued" className="text-sm">{formatDate(q.issue_date)}</TableCell>
            <TableCell label="Valid until" className="text-sm">{formatDate(q.valid_until)}</TableCell>
            <TableCell label="Status"><StatusBadge def={QUOTATION_STATUS} value={q.status} /></TableCell>
            <TableCell label="Total" className="pr-4 text-right font-medium tabular-nums">{formatINR(q.total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function InvoicesTable({ rows, sortable = true, hrefBase = "/invoices" }: { rows: InvoiceRow[]; sortable?: boolean; hrefBase?: string }) {
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead className="pl-4"><S s={sortable} col="number">Invoice</S></TableHead>
        <TableHead>Client</TableHead>
        <TableHead><S s={sortable} col="invoice_date">Date</S></TableHead>
        <TableHead><S s={sortable} col="due_date">Due</S></TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right"><S s={sortable} col="total" dir="desc">Total</S></TableHead>
        <TableHead className="pr-4 text-right"><S s={sortable} col="balance_due" dir="desc">Balance</S></TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((i) => {
          const st = effectiveInvoiceStatus(i);
          return (
            <TableRow key={i.id}>
              <TableCell className="pl-4"><Link href={`${hrefBase}/${i.id}`} className="font-medium hover:text-primary">{i.number}</Link>{i.project && <p className="text-xs text-muted-foreground">{i.project.name}</p>}</TableCell>
              <TableCell label="Client">{i.client?.company_name ?? "—"}</TableCell>
              <TableCell label="Date" className="text-sm">{formatDate(i.invoice_date)}</TableCell>
              <TableCell label="Due" className={cn("text-sm", st === "overdue" && "font-medium text-destructive")}>{formatDate(i.due_date)}</TableCell>
              <TableCell label="Status"><StatusBadge def={INVOICE_STATUS} value={st} /></TableCell>
              <TableCell label="Total" className="text-right tabular-nums">{formatINR(i.total)}</TableCell>
              <TableCell label="Balance" className={cn("pr-4 text-right font-medium tabular-nums", Number(i.balance_due) > 0 && st !== "draft" && st !== "cancelled" ? "" : "text-muted-foreground")}>{formatINR(i.balance_due)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function PaymentsTable({ rows, sortable = true, actions }: { rows: PaymentRow[]; sortable?: boolean; actions?: (p: PaymentRow) => React.ReactNode }) {
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead className="pl-4">Receipt</TableHead>
        <TableHead>Client</TableHead>
        <TableHead>Invoice</TableHead>
        <TableHead><S s={sortable} col="payment_date">Date</S></TableHead>
        <TableHead>Method</TableHead>
        <TableHead>Type</TableHead>
        <TableHead className="text-right"><S s={sortable} col="amount" dir="desc">Amount</S></TableHead>
        {actions && <TableHead className="pr-4"><span className="sr-only">Actions</span></TableHead>}
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="pl-4">
              <Link href={`/print/receipt/${p.id}`} className="font-medium hover:text-primary">{p.receipt_number}</Link>
              <p className="text-xs text-muted-foreground">{p.transaction_id ?? p.reference_number ?? ""}</p>
            </TableCell>
            <TableCell label="Client">{p.client?.company_name ?? "—"}</TableCell>
            <TableCell label="Invoice" className="text-sm">{p.invoice?.number ?? <span className="text-muted-foreground">On account</span>}</TableCell>
            <TableCell label="Date" className="text-sm">{formatDate(p.payment_date)}</TableCell>
            <TableCell label="Method" className="text-sm">{PAYMENT_METHOD.label[p.method as keyof typeof PAYMENT_METHOD.label]}</TableCell>
            <TableCell label="Type"><StatusBadge def={PAYMENT_TYPE} value={p.payment_type} /></TableCell>
            <TableCell label="Amount" className="text-right font-medium tabular-nums">{formatINR(p.amount)}</TableCell>
            {actions && <TableCell actions className="pr-4">{actions(p)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
