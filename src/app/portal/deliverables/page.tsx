import { Layers } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { APPROVAL_STATUS, REVIEW_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { portalDeliverables } from "@/features/portal/queries";

export default async function PortalDeliverables() {
  await requireClient();
  const rows = await portalDeliverables();
  return (
    <>
      <PageHeader title="Deliverables" description="Every design shared with you and where it stands." />
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? <EmptyState icon={Layers} title="No deliverables shared yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead className="pl-4">Deliverable</TableHead><TableHead>Project</TableHead><TableHead>Review</TableHead><TableHead>Approval</TableHead><TableHead>Submitted</TableHead><TableHead>Delivered</TableHead><TableHead className="pr-4">File</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="pl-4 font-medium">{d.name}</TableCell>
                <TableCell className="text-sm">{d.project?.name}</TableCell>
                <TableCell><StatusBadge def={REVIEW_STATUS} value={d.client_review_status} /></TableCell>
                <TableCell><StatusBadge def={APPROVAL_STATUS} value={d.approval_status} />{d.approved_at && <p className="text-[11px] text-muted-foreground">{formatDate(d.approved_at)}</p>}</TableCell>
                <TableCell className="text-sm">{formatDate(d.submitted_at)}</TableCell>
                <TableCell className="text-sm">{formatDate(d.final_delivered_at)}</TableCell>
                <TableCell className="pr-4">{d.file ? <a href={`/api/files/${d.file.id}?download=1`} className="text-sm text-primary hover:underline">Download v{d.file.version}</a> : "—"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
