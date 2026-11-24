import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PROJECT_CATEGORY, PROJECT_STATUS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination, TableToolbar } from "@/components/app/table-controls";
import { clientOptions, staffOptions } from "@/features/common/lookups";
import { listProjects } from "@/features/projects/queries";
import { ProjectsTable } from "@/features/projects/components/projects-table";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const session = await requireStaff();
  const sp = await searchParams;
  const [{ rows, total, params }, staff, clients] = await Promise.all([listProjects(sp), staffOptions(session.orgId), clientOptions()]);
  const add = can(session.role, "projects.manage") ? <Button render={<Link href="/projects/new" />}><Plus /> New project</Button> : null;
  return (
    <>
      <PageHeader title="Projects" description={session.role === "team_member" ? "Projects you manage or are assigned to." : "Every client engagement with its deliverables, team, approvals and billing."} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Projects" }]} actions={add} />
      <Panel bodyClassName="p-0">
        <TableToolbar sorts={[{ value: "due_date:asc", label: "Delivery soonest" }, { value: "created_at:desc", label: "Newest first" }, { value: "progress:desc", label: "Most progress" }, { value: "name:asc", label: "Name A–Z" }]} placeholder="Search projects…" filters={[
          { name: "status", label: "Status", options: [{ value: "active", label: "All active" }, ...PROJECT_STATUS.options] },
          { name: "category", label: "Category", options: PROJECT_CATEGORY.options },
          { name: "client", label: "Client", options: clients },
          { name: "manager", label: "Manager", options: staff },
          { name: "overdue", label: "Deadline", options: [{ value: "1", label: "Overdue" }] },
        ]} />
        {rows.length === 0 ? <EmptyState icon={FolderKanban} title={params.q ? "No projects match" : "No projects yet"} description={session.role === "team_member" ? "You'll see projects here once a manager adds you to one." : "Create a project or convert a won lead."} action={add} /> : (
          <><ProjectsTable rows={rows} /><Pagination total={total} pageSize={params.pageSize} /></>
        )}
      </Panel>
    </>
  );
}
