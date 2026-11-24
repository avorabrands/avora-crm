import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, FolderKanban, Pencil, Plus, Receipt, Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { CLIENT_STATUS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { DescriptionList, Panel, StatCard } from "@/components/app/panel";
import { StatusBadge } from "@/components/app/status-badge";
import { PersonCell } from "@/components/app/user-avatar";
import { EmptyState } from "@/components/app/empty-state";
import { FormSheet } from "@/components/app/form";
import { ConfirmAction } from "@/components/app/confirm";
import { TabNav, currentTab } from "@/components/app/tab-nav";
import { clientOptions, projectOptions, staffOptions } from "@/features/common/lookups";
import { clientFinancials, getClient } from "@/features/clients/queries";
import { deleteClientRecord, inviteClientPortalUser, updateClientRecord } from "@/features/clients/actions";
import { ClientFields } from "@/features/clients/components/client-form";
import { PortalAccess, type PortalUser } from "@/features/clients/components/portal-access";
import { listProjects } from "@/features/projects/queries";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import { listAgreements, listInvoices, listPayments, listQuotations } from "@/features/finance/queries";
import { InvoicesTable, PaymentsTable, QuotationsTable } from "@/features/finance/components/finance-tables";
import { AddAgreementButton, AgreementsTable } from "@/features/finance/components/agreements";
import { listFiles } from "@/features/files/queries";
import { FileList } from "@/features/files/components/file-list";
import { FileUploadDialog } from "@/features/files/components/file-upload";
import { listActivity } from "@/features/activity/queries";
import { ActivityFeed } from "@/features/activity/activity-feed";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const session = await requireStaff("clients.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const client = await getClient(id);
  if (!client) notFound();

  const finance = can(session.role, "finance.view");
  const tabIds = ["overview", "projects", ...(finance ? ["quotations", "agreements", "invoices", "payments"] : []), "files", "activity"];
  const tab = currentTab(sp, tabIds);
  const label: Record<string, string> = { overview: "Overview", projects: "Projects", quotations: "Quotations", agreements: "Agreements", invoices: "Invoices", payments: "Payments", files: "Files", activity: "Activity history" };
  const staff = await staffOptions(session.orgId);
  const base = `/clients/${id}`;
  const listSp = { ...sp, tab: undefined };

  return (
    <>
      <PageHeader
        title={client.company_name}
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: client.code }]}
        meta={<><StatusBadge def={CLIENT_STATUS} value={client.status} />{client.category && <span className="text-xs text-muted-foreground">{client.category}</span>}</>}
        actions={<>
          {can(session.role, "projects.manage") && <Button variant="outline" render={<Link href={`/projects/new?client=${id}`} />}><Plus /> New project</Button>}
          {finance && <Button variant="outline" render={<Link href={`/quotations/new?client=${id}`} />}><FileText /> New quotation</Button>}
          {can(session.role, "clients.manage") && (
            <FormSheet trigger={<Button><Pencil /> Edit</Button>} title={`Edit ${client.company_name}`} action={updateClientRecord.bind(null, id)}>
              <ClientFields staff={staff} client={client} />
            </FormSheet>
          )}
        </>}
      />
      <TabNav base={base} current={tab} tabs={tabIds.map((t) => ({ id: t, label: label[t]! }))} />

      {tab === "overview" && <Overview session={session} client={client} finance={finance} />}
      {tab === "projects" && <ProjectsTab clientId={id} sp={listSp} />}
      {tab === "quotations" && <QuotationsTab clientId={id} sp={listSp} />}
      {tab === "agreements" && <AgreementsTab clientId={id} sp={listSp} canManage={can(session.role, "finance.manage")} />}
      {tab === "invoices" && <InvoicesTab clientId={id} sp={listSp} />}
      {tab === "payments" && <PaymentsTab clientId={id} sp={listSp} />}
      {tab === "files" && <FilesTab clientId={id} sp={listSp} canManage={can(session.role, "projects.manage")} canDelete={can(session.role, "files.delete")} />}
      {tab === "activity" && <Panel title="Activity history"><ActivityFeed items={await listActivity({ clientId: id, limit: 100 })} showVisibility /></Panel>}

      {tab === "overview" && can(session.role, "clients.delete") && (
        <div className="mt-8 flex justify-end">
          <ConfirmAction trigger={<Button variant="ghost" className="text-destructive">Delete client</Button>} title={`Delete ${client.company_name}?`} description="Only clients without projects can be deleted. This removes the client, contacts and portal access permanently." action={deleteClientRecord.bind(null, id)} redirectTo="/clients" />
        </div>
      )}
    </>
  );
}

async function Overview({ session, client, finance }: { session: Awaited<ReturnType<typeof requireStaff>>; client: NonNullable<Awaited<ReturnType<typeof getClient>>>; finance: boolean }) {
  const supabase = await createClient();
  const [money, { count: projectCount }, { count: activeCount }, portalUsers, contacts] = await Promise.all([
    finance ? clientFinancials([client.id]) : Promise.resolve({} as Record<string, { invoiced: number; received: number; outstanding: number }>),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", client.id),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", client.id).not("status", "in", "(completed,cancelled)"),
    supabase.from("organization_members").select("id, status, profile:profiles(full_name, email)").eq("client_id", client.id).eq("role", "client"),
    supabase.from("contacts").select("id, name, designation, email, phone, is_primary").eq("client_id", client.id).order("is_primary", { ascending: false }),
  ]);
  const m = money[client.id] ?? { invoiced: 0, received: 0, outstanding: 0 };
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects" value={projectCount ?? 0} hint={`${activeCount ?? 0} active`} icon={FolderKanban} />
        {finance && <StatCard label="Total invoiced" value={formatINR(m.invoiced)} icon={Receipt} />}
        {finance && <StatCard label="Revenue received" value={formatINR(m.received)} icon={Wallet} tone="success" />}
        {finance && <StatCard label="Outstanding" value={formatINR(m.outstanding)} icon={Wallet} tone={m.outstanding > 0 ? "warning" : "default"} />}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Company details">
          <DescriptionList items={[
            { label: "Client ID", value: client.code },
            { label: "Contact person", value: client.contact_person },
            { label: "Phone", value: client.phone },
            { label: "Email", value: client.email },
            { label: "Website", value: client.website && <a href={client.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{client.website.replace(/^https?:\/\//, "")}</a> },
            { label: "Account manager", value: <PersonCell name={client.manager?.full_name} /> },
            { label: "GSTIN", value: client.gstin },
            { label: "PAN", value: client.pan },
            { label: "State", value: client.state },
            { label: "Client since", value: formatDate(client.created_at) },
          ]} />
          {client.billing_address && <div className="mt-4"><p className="text-xs text-muted-foreground">Billing address</p><p className="mt-0.5 text-sm whitespace-pre-wrap">{client.billing_address}</p></div>}
          {client.notes && <div className="mt-4 rounded-lg bg-muted/60 p-3"><p className="text-xs font-medium text-muted-foreground">Internal notes</p><p className="mt-1 text-sm whitespace-pre-wrap">{client.notes}</p></div>}
          {client.lead_id && <p className="mt-4 text-xs text-muted-foreground">Converted from <Link href={`/leads/${client.lead_id}`} className="text-primary hover:underline">lead</Link></p>}
        </Panel>
        <div className="space-y-6">
          <Panel title="Client portal access" description="People who can sign in to see this client's shared work.">
            <PortalAccess clientId={client.id} users={(portalUsers.data ?? []) as unknown as PortalUser[]} invite={inviteClientPortalUser.bind(null, client.id)} canManage={session.role === "admin"} defaultName={client.contact_person} defaultEmail={client.email} />
          </Panel>
          <Panel title="Contacts">
            {(contacts.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No additional contacts.</p> : (
              <ul className="space-y-3">{(contacts.data ?? []).map((c) => <li key={c.id}><PersonCell name={c.name} sub={[c.designation, c.email, c.phone].filter(Boolean).join(" · ")} /></li>)}</ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

async function ProjectsTab({ clientId, sp }: { clientId: string; sp: Record<string, string | string[] | undefined> }) {
  const { rows } = await listProjects(sp, { clientId });
  return <Panel bodyClassName="p-0">{rows.length ? <ProjectsTable rows={rows} showClient={false} sortable={false} /> : <EmptyState icon={FolderKanban} title="No projects yet" action={<Button render={<Link href={`/projects/new?client=${clientId}`} />}><Plus /> New project</Button>} />}</Panel>;
}
async function QuotationsTab({ clientId, sp }: { clientId: string; sp: Record<string, string | string[] | undefined> }) {
  const { rows } = await listQuotations(sp, { clientId });
  return <Panel bodyClassName="p-0">{rows.length ? <QuotationsTable rows={rows} sortable={false} /> : <EmptyState icon={FileText} title="No quotations" action={<Button render={<Link href={`/quotations/new?client=${clientId}`} />}><Plus /> New quotation</Button>} />}</Panel>;
}
async function AgreementsTab({ clientId, sp, canManage }: { clientId: string; sp: Record<string, string | string[] | undefined>; canManage: boolean }) {
  const [{ rows }, clients, projects] = await Promise.all([listAgreements(sp, { clientId }), clientOptions(), projectOptions(clientId)]);
  return <Panel title="Agreements" action={canManage && <AddAgreementButton clients={clients} projects={projects} fixedClientId={clientId} />} bodyClassName="p-0"><AgreementsTable rows={rows} clients={clients} projects={projects} canManage={canManage} showClient={false} /></Panel>;
}
async function InvoicesTab({ clientId, sp }: { clientId: string; sp: Record<string, string | string[] | undefined> }) {
  const { rows } = await listInvoices(sp, { clientId });
  return <Panel bodyClassName="p-0">{rows.length ? <InvoicesTable rows={rows} sortable={false} /> : <EmptyState icon={Receipt} title="No invoices" action={<Button render={<Link href={`/invoices/new?client=${clientId}`} />}><Plus /> New invoice</Button>} />}</Panel>;
}
async function PaymentsTab({ clientId, sp }: { clientId: string; sp: Record<string, string | string[] | undefined> }) {
  const { rows } = await listPayments(sp, { clientId });
  const total = rows.reduce((a, p) => a + Number(p.amount), 0);
  return <Panel title="Payment history" description={`${rows.length} payments · ${formatINR(total)} received`} bodyClassName="p-0">{rows.length ? <PaymentsTable rows={rows} sortable={false} /> : <EmptyState icon={Wallet} title="No payments recorded" />}</Panel>;
}
async function FilesTab({ clientId, sp, canManage, canDelete }: { clientId: string; sp: Record<string, string | string[] | undefined>; canManage: boolean; canDelete: boolean }) {
  const [{ rows }, projects] = await Promise.all([listFiles(sp, { clientId }), projectOptions(clientId)]);
  return (
    <Panel title="Files" description="All files across this client's projects, plus client-level documents." action={<FileUploadDialog clientId={clientId} projects={projects} />} bodyClassName="p-0">
      {rows.length ? <FileList files={rows} showContext canManage={canManage} canDelete={canDelete} /> : <EmptyState title="No files yet" />}
    </Panel>
  );
}
