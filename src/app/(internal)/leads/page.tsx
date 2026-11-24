import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { str } from "@/lib/list-params";
import { LEAD_SOURCES, LEAD_STATUS } from "@/lib/constants";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { PersonCell } from "@/components/app/user-avatar";
import { FormSheet } from "@/components/app/form";
import { Pagination, SortHeader, TableToolbar, ViewSwitch } from "@/components/app/table-controls";
import { staffOptions } from "@/features/common/lookups";
import { listLeads } from "@/features/leads/queries";
import { createLead, updateLead } from "@/features/leads/actions";
import { LeadFields } from "@/features/leads/components/lead-form";
import { LeadsBoard } from "@/features/leads/components/leads-board";
import { LeadRowActions } from "@/features/leads/components/lead-row-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const session = await requireStaff("leads.view");
  const sp = await searchParams;
  const board = str(sp, "view") === "board";
  const [{ rows, total, params }, staff] = await Promise.all([listLeads(sp, { board }), staffOptions(session.orgId)]);
  const canManage = can(session.role, "leads.manage");

  const newLead = canManage ? (
    <FormSheet trigger={<Button><Plus /> Add lead</Button>} title="New lead" description="Capture an enquiry. You can convert it to a client once won." action={createLead}>
      <LeadFields staff={staff} />
    </FormSheet>
  ) : null;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry from first contact to won or lost. Drag cards on the board to move them through stages."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Leads" }]}
        actions={<>
          <ViewSwitch defaultView="table" views={[{ value: "table", label: "Table", icon: "list" }, { value: "board", label: "Board", icon: "board" }]} />
          {newLead}
        </>}
      />
      <Panel bodyClassName="p-0">
        <TableToolbar
          placeholder="Search company, contact, phone, email…"
          filters={[
            ...(board ? [] : [{ name: "status", label: "Status", options: LEAD_STATUS.options }]),
            { name: "source", label: "Source", options: LEAD_SOURCES.map((s) => ({ value: s, label: s })) },
            { name: "assignee", label: "Owner", options: [{ value: "none", label: "Unassigned" }, ...staff] },
            { name: "due", label: "Follow-up", options: [{ value: "1", label: "Due / overdue" }] },
          ]}
        />
        {board ? (
          <div className="p-3">{rows.length ? <LeadsBoard leads={rows} /> : <EmptyState icon={Target} title="No leads match" description="Try clearing filters or add a new lead." action={newLead} />}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Target} title={params.q ? "No leads match your search" : "No leads yet"} description="Leads you add or receive will show up here." action={newLead} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4"><SortHeader column="company_name">Company</SortHeader></TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead><SortHeader column="estimated_budget" defaultDir="desc">Budget</SortHeader></TableHead>
                  <TableHead><SortHeader column="status">Status</SortHeader></TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead><SortHeader column="next_follow_up">Follow-up</SortHeader></TableHead>
                  <TableHead className="pr-4 text-right"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-4">
                      <Link href={`/leads/${l.id}`} className="font-medium hover:text-primary">{l.company_name}</Link>
                      <p className="text-xs text-muted-foreground">{l.code}{l.source ? ` · ${l.source}` : ""}</p>
                    </TableCell>
                    <TableCell>
                      <p>{l.contact_person ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{l.phone ?? l.email ?? ""}</p>
                    </TableCell>
                    <TableCell className="max-w-48"><p className="truncate text-xs text-muted-foreground">{l.services.join(", ") || "—"}</p></TableCell>
                    <TableCell className="tabular-nums">{l.estimated_budget ? formatINR(l.estimated_budget) : "—"}</TableCell>
                    <TableCell><StatusBadge def={LEAD_STATUS} value={l.status} /></TableCell>
                    <TableCell><PersonCell name={l.assignee?.full_name} /></TableCell>
                    <TableCell className={cn("text-sm", l.next_follow_up && l.next_follow_up <= todayISO() && !["won", "lost"].includes(l.status) && "font-medium text-destructive")}>{formatDate(l.next_follow_up)}</TableCell>
                    <TableCell className="pr-4"><LeadRowActions lead={l} staff={staff} update={updateLead.bind(null, l.id)} canDelete={can(session.role, "leads.delete")} /></TableCell>
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
