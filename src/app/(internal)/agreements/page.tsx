import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AGREEMENT_STATUS } from "@/lib/constants";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { Pagination, TableToolbar } from "@/components/app/table-controls";
import { clientOptions, projectOptions } from "@/features/common/lookups";
import { listAgreements } from "@/features/finance/queries";
import { AddAgreementButton, AgreementsTable } from "@/features/finance/components/agreements";

export const metadata: Metadata = { title: "Agreements" };

export default async function AgreementsPage({ searchParams }: PageProps<"/agreements">) {
  const s = await requireStaff("finance.view");
  const sp = await searchParams;
  const [{ rows, total, params }, clients, projects] = await Promise.all([listAgreements(sp), clientOptions(), projectOptions()]);
  const manage = can(s.role, "finance.manage");
  return (
    <>
      <PageHeader title="Agreements" description="Upload signed contracts, NDAs and SOWs, and track their status and term." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Agreements" }]} actions={manage && <AddAgreementButton clients={clients} projects={projects} />} />
      <Panel bodyClassName="p-0">
        <TableToolbar placeholder="Search agreements…" filters={[{ name: "status", label: "Status", options: AGREEMENT_STATUS.options }]} />
        <AgreementsTable rows={rows} clients={clients} projects={projects} canManage={manage} />
        {rows.length > 0 && <Pagination total={total} pageSize={params.pageSize} />}
      </Panel>
    </>
  );
}
