import Link from "next/link";
import { FileText } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { QUOTATION_STATUS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

export default async function PortalQuotations() {
  await requireClient();
  const supabase = await createClient();
  const { data } = await supabase.from("quotations").select("id, number, title, issue_date, valid_until, status, total").order("issue_date", { ascending: false });
  return (
    <>
      <PageHeader title="Quotations" description="Review proposals from Avora and accept them online." />
      <Panel bodyClassName="p-0">
        {(data ?? []).length === 0 ? <EmptyState icon={FileText} title="No quotations yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead className="pl-4">Quotation</TableHead><TableHead>Date</TableHead><TableHead>Valid until</TableHead><TableHead>Status</TableHead><TableHead className="pr-4 text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{(data ?? []).map((q) => (
              <TableRow key={q.id}>
                <TableCell className="pl-4"><Link href={`/portal/quotations/${q.id}`} className="font-medium hover:text-primary">{q.number}</Link><p className="text-xs text-muted-foreground">{q.title}</p></TableCell>
                <TableCell label="Date" className="text-sm">{formatDate(q.issue_date)}</TableCell><TableCell label="Valid until" className="text-sm">{formatDate(q.valid_until)}</TableCell>
                <TableCell label="Status"><StatusBadge def={QUOTATION_STATUS} value={q.status} /></TableCell><TableCell label="Total" className="pr-4 text-right font-medium tabular-nums">{formatINR(q.total)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
