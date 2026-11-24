import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD, PAYMENT_TYPE } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { Panel, StatCard } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { RowActions } from "@/components/app/row-actions";
import { Pagination, TableToolbar } from "@/components/app/table-controls";
import { clientOptions } from "@/features/common/lookups";
import { listPayments, openInvoiceOptions } from "@/features/finance/queries";
import { deletePayment } from "@/features/finance/invoice-actions";
import { PaymentsTable } from "@/features/finance/components/finance-tables";
import { RecordPaymentButton } from "@/features/finance/components/record-payment";
import { format, startOfMonth } from "date-fns";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const s = await requireStaff("finance.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const [{ rows, total, params }, clients, invoices, { data: all }] = await Promise.all([listPayments(sp), clientOptions(), openInvoiceOptions(), supabase.from("payments").select("amount, payment_date, payment_type")]);
  const sum = (f: (p: { amount: number; payment_date: string; payment_type: string }) => boolean) => (all ?? []).filter(f).reduce((a, p) => a + Number(p.amount), 0);
  const record = can(s.role, "finance.manage") ? <RecordPaymentButton invoices={invoices} clients={clients} /> : null;
  return (
    <>
      <PageHeader title="Payments" description="Manual payment records — advances, milestones, partial and final payments. Each one gets a printable receipt." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments" }]} actions={record} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total received" value={formatINR(sum(() => true))} tone="success" />
        <StatCard label="This month" value={formatINR(sum((p) => p.payment_date >= monthStart))} />
        <StatCard label="Advances" value={formatINR(sum((p) => p.payment_type === "advance"))} />
        <StatCard label="Open invoices" value={invoices.length} hint={formatINR(invoices.reduce((a, i) => a + i.balance, 0)) + " outstanding"} tone="warning" href="/invoices?status=outstanding" />
      </div>
      <Panel bodyClassName="p-0">
        <TableToolbar sorts={[{ value: "payment_date:desc", label: "Newest first" }, { value: "amount:desc", label: "Largest amount" }]} placeholder="Search receipt, UTR, reference…" filters={[{ name: "client", label: "Client", options: clients }, { name: "method", label: "Method", options: PAYMENT_METHOD.options }, { name: "type", label: "Type", options: PAYMENT_TYPE.options }]} />
        {rows.length ? <><PaymentsTable rows={rows} actions={can(s.role, "finance.delete") ? (p) => <RowActions onDelete={deletePayment.bind(null, p.id)} deleteTitle={`Delete ${p.receipt_number}?`} deleteDescription="The linked invoice balance will be recalculated. This cannot be undone." /> : undefined} /><Pagination total={total} pageSize={params.pageSize} /></> : <EmptyState icon={Wallet} title="No payments recorded" action={record} />}
      </Panel>
    </>
  );
}
