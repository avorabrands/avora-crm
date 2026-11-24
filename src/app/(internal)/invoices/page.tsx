import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { INVOICE_STATUS } from "@/lib/constants";
import { formatINR, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Panel, StatCard } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination, TableToolbar } from "@/components/app/table-controls";
import { clientOptions } from "@/features/common/lookups";
import { listInvoices } from "@/features/finance/queries";
import { InvoicesTable } from "@/features/finance/components/finance-tables";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  await requireStaff("finance.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ rows, total, params }, clients, { data: all }] = await Promise.all([listInvoices(sp), clientOptions(), supabase.from("invoices").select("status, total, amount_paid, due_date").not("status", "in", "(draft,cancelled)")]);
  const inv = all ?? [];
  const invoiced = inv.reduce((a, i) => a + Number(i.total), 0);
  const received = inv.reduce((a, i) => a + Number(i.amount_paid), 0);
  const overdue = inv.filter((i) => ["unpaid", "partially_paid"].includes(i.status) && i.due_date < todayISO()).reduce((a, i) => a + Number(i.total) - Number(i.amount_paid), 0);
  const add = <Button render={<Link href="/invoices/new" />}><Plus /> New invoice</Button>;
  return (
    <>
      <PageHeader title="Invoices" description="GST invoices with automatic balances. Overdue is calculated from the due date." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Invoices" }]} actions={add} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total invoiced" value={formatINR(invoiced)} href="/invoices" />
        <StatCard label="Received" value={formatINR(received)} tone="success" href="/payments" />
        <StatCard label="Outstanding" value={formatINR(invoiced - received)} tone="warning" href="/invoices?status=outstanding" />
        <StatCard label="Overdue" value={formatINR(overdue)} tone={overdue > 0 ? "danger" : "default"} href="/invoices?status=overdue" />
      </div>
      <Panel bodyClassName="p-0">
        <TableToolbar sorts={[{ value: "invoice_date:desc", label: "Newest first" }, { value: "due_date:asc", label: "Due soonest" }, { value: "balance_due:desc", label: "Largest balance" }]} placeholder="Search invoice number…" filters={[{ name: "status", label: "Status", options: [{ value: "outstanding", label: "Outstanding" }, ...INVOICE_STATUS.options] }, { name: "client", label: "Client", options: clients }]} />
        {rows.length ? <><InvoicesTable rows={rows} /><Pagination total={total} pageSize={params.pageSize} /></> : <EmptyState icon={Receipt} title="No invoices found" action={add} />}
      </Panel>
    </>
  );
}
