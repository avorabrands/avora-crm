import { Files } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatBytes, formatDate } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";

export default async function PortalFiles() {
  await requireClient();
  const supabase = await createClient();
  const { data } = await supabase.from("files").select("id, name, folder, version, size_bytes, created_at, project:projects(name)").eq("is_latest", true).order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as { id: string; name: string; folder: string; version: number; size_bytes: number; created_at: string; project: { name: string } | null }[];
  return (
    <>
      <PageHeader title="Files" description="Files the Avora team has shared with you. Download anytime — originals can't be changed from the portal." />
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? <EmptyState icon={Files} title="No files shared yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead className="pl-4">File</TableHead><TableHead>Project</TableHead><TableHead>Folder</TableHead><TableHead>Version</TableHead><TableHead>Size</TableHead><TableHead>Shared</TableHead><TableHead className="pr-4" /></TableRow></TableHeader>
            <TableBody>{rows.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="pl-4"><a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">{f.name}</a></TableCell>
                <TableCell label="Project" className="text-sm">{f.project?.name ?? "—"}</TableCell><TableCell label="Folder" className="text-sm">{f.folder}</TableCell><TableCell label="Version">v{f.version}</TableCell>
                <TableCell label="Size" className="text-xs text-muted-foreground">{formatBytes(f.size_bytes)}</TableCell><TableCell label="Shared" className="text-sm">{formatDate(f.created_at)}</TableCell>
                <TableCell actions className="pr-4"><a href={`/api/files/${f.id}?download=1`} className="text-sm text-primary hover:underline">Download</a></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
