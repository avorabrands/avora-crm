import type { Metadata } from "next";
import { Files } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { FILE_CATEGORY } from "@/lib/constants";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination, TableToolbar } from "@/components/app/table-controls";
import { projectOptions } from "@/features/common/lookups";
import { listFiles } from "@/features/files/queries";
import { FileList } from "@/features/files/components/file-list";
import { FileUploadDialog } from "@/features/files/components/file-upload";

export const metadata: Metadata = { title: "Files" };

export default async function FilesPage({ searchParams }: PageProps<"/files">) {
  const s = await requireStaff();
  const sp = await searchParams;
  const [{ rows, total, params }, projects] = await Promise.all([listFiles(sp), projectOptions()]);
  return (
    <>
      <PageHeader title="Files" description="Private, versioned file storage organised by client, project and folder. Clients only see files you explicitly share." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Files" }]} actions={projects.length > 0 && <FileUploadDialog projects={projects} />} />
      <Panel bodyClassName="p-0">
        <TableToolbar placeholder="Search file name…" filters={[
          { name: "project", label: "Project", options: projects },
          { name: "category", label: "Type", options: FILE_CATEGORY.options },
          { name: "shared", label: "Visibility", options: [{ value: "1", label: "Shared with client" }, { value: "0", label: "Internal only" }] },
        ]} />
        {rows.length ? <><FileList files={rows} showContext canManage={can(s.role, "projects.manage")} canDelete={can(s.role, "files.delete")} /><Pagination total={total} pageSize={params.pageSize} /></> : <EmptyState icon={Files} title="No files found" description="Uploaded briefs, designs and agreements appear here." />}
      </Panel>
    </>
  );
}
