import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { fileVersions } from "@/features/files/queries";
import { FileList } from "@/features/files/components/file-list";

export const metadata: Metadata = { title: "Version history" };

export default async function VersionsPage({ params }: PageProps<"/files/[id]/versions">) {
  const s = await requireStaff();
  const { id } = await params;
  const versions = await fileVersions(id);
  if (!versions.length) notFound();
  const root = versions[versions.length - 1]!;
  return (
    <>
      <PageHeader title={root.name} description={`${versions.length} versions · newest first`} breadcrumbs={[{ label: "Files", href: "/files" }, ...(root.project ? [{ label: root.project.name, href: `/projects/${root.project_id}?tab=files` }] : []), { label: "Versions" }]} />
      <Panel bodyClassName="p-0"><FileList files={versions} canManage={can(s.role, "projects.manage")} canDelete={can(s.role, "files.delete")} /></Panel>
    </>
  );
}
