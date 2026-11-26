import Link from "next/link";
import { FileText } from "lucide-react";
import { requireLead } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { QUOTATION_STATUS } from "@/lib/constants";
import { formatDate, formatINR, firstName } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

export const metadata = { title: "Your quotations" };

export default async function LeadHome() {
  const s = await requireLead();
  const supabase = await createClient();
  // RLS returns only this lead's quotations that have been sent
  const { data } = await supabase.from("quotations").select("id, number, title, issue_date, valid_until, status, total").order("issue_date", { ascending: false });
  const rows = data ?? [];
  return (
    <>
      <PageHeader title={`Hello, ${firstName(s.fullName)}`} description="Quotations from Avora Brands. Open one to view, download or accept it." />
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? <EmptyState icon={FileText} title="No quotations yet" description="When Avora sends you a quotation it will appear here." /> : (
          <Table className="stack">
            <TableHeader><TableRow><TableHead className="pl-4">Quotation</TableHead><TableHead>Date</TableHead><TableHead>Valid until</TableHead><TableHead>Status</TableHead><TableHead className="pr-4 text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((q) => (
              <TableRow key={q.id}>
                <TableCell data-title className="pl-4"><Link href={`/lead/quotations/${q.id}`} className="font-medium hover:text-primary">{q.number}</Link><p className="text-xs text-muted-foreground">{q.title}</p></TableCell>
                <TableCell label="Date" className="text-sm">{formatDate(q.issue_date)}</TableCell>
                <TableCell label="Valid until" className="text-sm">{formatDate(q.valid_until)}</TableCell>
                <TableCell label="Status"><StatusBadge def={QUOTATION_STATUS} value={q.status} /></TableCell>
                <TableCell label="Total" className="pr-4 text-right font-medium tabular-nums">{formatINR(q.total)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
