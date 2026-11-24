import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Download, Pencil, Send, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { INVOICE_STATUS } from "@/lib/constants";
import { effectiveInvoiceStatus, formatDate, formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmAction } from "@/components/app/confirm";
import { RowActions } from "@/components/app/row-actions";
import { companySettings } from "@/features/common/lookups";
import { getInvoice } from "@/features/finance/queries";
import { cancelInvoice, deleteInvoice, deletePayment, issueInvoice } from "@/features/finance/invoice-actions";
import { FinanceDocument } from "@/features/finance/components/document";
import { PaymentsTable } from "@/features/finance/components/finance-tables";
import { RecordPaymentButton } from "@/features/finance/components/record-payment";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const s = await requireStaff("finance.view");
  const { id } = await params;
  const [{ invoice: inv, items, payments }, company] = await Promise.all([getInvoice(id), companySettings(s.orgId)]);
  if (!inv) notFound();
  const st = effectiveInvoiceStatus(inv);
  const manage = can(s.role, "finance.manage");
  const open = ["unpaid", "partially_paid"].includes(inv.status);
  const opt = { value: inv.id, label: inv.number, balance: Number(inv.balance_due), clientId: inv.client_id };

  return (
    <>
      <PageHeader
        title={inv.number}
        description={inv.client?.company_name}
        breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: inv.number }]}
        meta={<><StatusBadge def={INVOICE_STATUS} value={st} /><span className="text-xs text-muted-foreground">Due {formatDate(inv.due_date)} · balance {formatINR(inv.balance_due)}</span></>}
        actions={<>
          <Button variant="outline" render={<Link href={`/print/invoice/${id}`} />}><Download /> PDF</Button>
          {manage && <>
            {inv.status !== "cancelled" && Number(inv.amount_paid) === 0 && <Button variant="outline" render={<Link href={`/invoices/${id}/edit`} />}><Pencil /> Edit</Button>}
            {inv.status === "draft" && <ConfirmAction trigger={<Button><Send /> Issue invoice</Button>} title="Issue this invoice?" description="It becomes visible in the client portal and counts towards outstanding. No email is sent (email delivery isn't configured)." confirmLabel="Issue" destructive={false} action={issueInvoice.bind(null, id)} />}
            {open && <RecordPaymentButton invoices={[]} clients={[]} fixedInvoice={opt} />}
            {inv.status !== "cancelled" && inv.status !== "paid" && Number(inv.amount_paid) === 0 && <ConfirmAction trigger={<Button variant="outline"><Ban /> Cancel</Button>} title={`Cancel ${inv.number}?`} description="The invoice will be void and excluded from revenue. The number is not reused." confirmLabel="Cancel invoice" action={cancelInvoice.bind(null, id)} />}
            {can(s.role, "finance.delete") && ["draft", "cancelled"].includes(inv.status) && <ConfirmAction trigger={<Button variant="ghost" size="icon" aria-label="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>} title={`Delete ${inv.number}?`} description="Permanently deletes this draft/cancelled invoice." action={deleteInvoice.bind(null, id)} redirectTo="/invoices" />}
          </>}
        </>}
      />
      <div className="space-y-6">
        <FinanceDocument kind="Tax Invoice" number={inv.number} title={inv.project?.name} company={company} party={inv.client} items={items} taxMode={inv.tax_mode}
          meta={[{ label: "Invoice date", value: formatDate(inv.invoice_date) }, { label: "Due date", value: formatDate(inv.due_date) }, ...(inv.quotation ? [{ label: "Quotation", value: inv.quotation.number }] : [])]}
          totals={inv} notes={inv.notes} terms={inv.terms ?? company?.default_terms} />
        <Panel className="mx-auto max-w-4xl" title="Payments" description={`${formatINR(inv.amount_paid)} of ${formatINR(inv.total)} received`} bodyClassName="p-0">
          {payments.length ? <PaymentsTable rows={payments} sortable={false} actions={can(s.role, "finance.delete") ? (p) => <RowActions onDelete={deletePayment.bind(null, p.id)} deleteTitle={`Delete ${p.receipt_number}?`} deleteDescription="The invoice balance will be recalculated." /> : undefined} /> : <p className="p-5 text-sm text-muted-foreground">No payments recorded yet.</p>}
        </Panel>
      </div>
    </>
  );
}
