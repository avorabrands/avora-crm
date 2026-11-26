import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { CLIENT_CATEGORIES, CLIENT_STATUS } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { PersonCell } from "@/components/app/user-avatar";
import { FormSheet } from "@/components/app/form";
import { Pagination, SortHeader, TableToolbar } from "@/components/app/table-controls";
import { staffOptions } from "@/features/common/lookups";
import { clientFinancials, listClients } from "@/features/clients/queries";
import { createClientRecord } from "@/features/clients/actions";
import { ClientFields } from "@/features/clients/components/client-form";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const session = await requireStaff("clients.view");
  const sp = await searchParams;
  const [{ rows, total, params }, staff] = await Promise.all([listClients(sp), staffOptions(session.orgId)]);
  const finance = can(session.role, "finance.view");
  const money = finance ? await clientFinancials(rows.map((r) => r.id)) : {};

  const add = can(session.role, "clients.manage") ? (
    <FormSheet openKey="client" trigger={<Button><Plus /> Add client</Button>} title="New client" description="Won leads can also be converted from the lead page." action={createClientRecord}>
      <ClientFields staff={staff} />
    </FormSheet>
  ) : null;
  const openAdd = add && <Button render={<Link href="/clients?new=client" scroll={false} />}><Plus /> Add client</Button>;

  return (
    <>
      <PageHeader title="Clients" description="Client profiles with their projects, documents, billing and full history." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Clients" }]} actions={add} />
      <Panel bodyClassName="p-0">
        <TableToolbar sorts={[{ value: "company_name:asc", label: "Company A–Z" }, { value: "created_at:desc", label: "Newest first" }, { value: "status:asc", label: "Status" }]} placeholder="Search company, contact, GSTIN…" filters={[
          { name: "status", label: "Status", options: CLIENT_STATUS.options },
          { name: "category", label: "Category", options: CLIENT_CATEGORIES.map((c) => ({ value: c, label: c })) },
          { name: "manager", label: "Manager", options: staff },
        ]} />
        {rows.length === 0 ? <EmptyState icon={Building2} title={params.q ? "No clients match" : "No clients yet"} description="Add a client or convert a won lead." action={openAdd} /> : (
          <>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="pl-4"><SortHeader column="company_name">Company</SortHeader></TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Category</TableHead>
                <TableHead><SortHeader column="status">Status</SortHeader></TableHead>
                <TableHead>Account manager</TableHead>
                {finance && <TableHead className="text-right">Revenue</TableHead>}
                {finance && <TableHead className="pr-4 text-right">Outstanding</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-4"><Link href={`/clients/${c.id}`} className="font-medium hover:text-primary">{c.company_name}</Link><p className="text-xs text-muted-foreground">{c.code}{c.gstin ? ` · ${c.gstin}` : ""}</p></TableCell>
                    <TableCell label="Contact"><p>{c.contact_person ?? "—"}</p><p className="text-xs text-muted-foreground">{c.email ?? c.phone ?? ""}</p></TableCell>
                    <TableCell label="Category" className="text-sm">{c.category ?? "—"}</TableCell>
                    <TableCell label="Status"><StatusBadge def={CLIENT_STATUS} value={c.status} /></TableCell>
                    <TableCell label="Account manager"><PersonCell name={c.manager?.full_name} /></TableCell>
                    {finance && <TableCell label="Revenue" className="text-right tabular-nums">{formatINR(money[c.id]?.received ?? 0)}</TableCell>}
                    {finance && <TableCell label="Outstanding" className="pr-4 text-right font-medium tabular-nums">{formatINR(money[c.id]?.outstanding ?? 0)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination total={total} pageSize={params.pageSize} />
          </>
        )}
      </Panel>
    </>
  );
}
