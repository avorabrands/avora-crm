import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { QUOTATION_STATUS } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Panel, StatCard } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination, TableToolbar } from "@/components/app/table-controls";
import { clientOptions } from "@/features/common/lookups";
import { listQuotations } from "@/features/finance/queries";
import { QuotationsTable } from "@/features/finance/components/finance-tables";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: PageProps<"/quotations">) {
  await requireStaff("finance.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ rows, total, params }, clients, { data: all }] = await Promise.all([listQuotations(sp), clientOptions(), supabase.from("quotations").select("status, total")]);
  const sum = (st: string[]) => (all ?? []).filter((q) => st.includes(q.status)).reduce((a, q) => a + Number(q.total), 0);
  const n = (st: string[]) => (all ?? []).filter((q) => st.includes(q.status)).length;
  const decided = n(["accepted", "rejected"]);
  const add = <Button render={<Link href="/quotations/new" />}><Plus /> New quotation</Button>;
  return (
    <>
      <PageHeader title="Quotations" description="Professional GST quotations with configurable tax slabs. Accepted quotations convert to invoices in one click." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Quotations" }]} actions={add} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Pending (sent/viewed)" value={formatINR(sum(["sent", "viewed"]))} hint={`${n(["sent", "viewed"])} quotations`} />
        <StatCard label="Drafts" value={n(["draft"])} />
        <StatCard label="Accepted value" value={formatINR(sum(["accepted"]))} tone="success" />
        <StatCard label="Acceptance rate" value={decided ? `${Math.round((n(["accepted"]) / decided) * 100)}%` : "—"} hint="Accepted ÷ decided" />
      </div>
      <Panel bodyClassName="p-0">
        <TableToolbar sorts={[{ value: "issue_date:desc", label: "Newest first" }, { value: "total:desc", label: "Highest value" }, { value: "status:asc", label: "Status" }]} placeholder="Search number or title…" filters={[{ name: "status", label: "Status", options: QUOTATION_STATUS.options }, { name: "client", label: "Client", options: clients }]} />
        {rows.length ? <><QuotationsTable rows={rows} /><Pagination total={total} pageSize={params.pageSize} /></> : <EmptyState icon={FileText} title="No quotations" description="Create your first quotation." action={add} />}
      </Panel>
    </>
  );
}
