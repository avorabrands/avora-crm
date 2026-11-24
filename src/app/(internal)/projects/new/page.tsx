import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { clientOptions, staffOptions } from "@/features/common/lookups";
import { createProject } from "@/features/projects/actions";
import { ProjectFields } from "@/features/projects/components/project-form";
import { NewProjectForm } from "./new-project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const session = await requireStaff("projects.manage");
  const sp = await searchParams;
  const [clients, staff] = await Promise.all([clientOptions(), staffOptions(session.orgId)]);
  return (
    <>
      <PageHeader title="New project" description="Set up the engagement. You can add deliverables, tasks and milestones in its workspace next." breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: "New" }]} />
      <Panel className="max-w-3xl">
        <NewProjectForm action={createProject}>
          <ProjectFields clients={clients} staff={staff} defaultClientId={typeof sp.client === "string" ? sp.client : undefined} memberIds={[]} />
        </NewProjectForm>
      </Panel>
    </>
  );
}
