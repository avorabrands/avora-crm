import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Copy, Download, Pencil, Receipt, Send, Trash2, X } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { QUOTATION_STATUS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmAction } from "@/components/app/confirm";
import { companySettings } from "@/features/common/lookups";
import { getQuotation } from "@/features/finance/queries";
import { deleteQuotation, duplicateQuotation, quotationToInvoice, setQuotationStatus } from "@/features/finance/quotation-actions";
import { FinanceDocument } from "@/features/finance/components/document";

export const metadata: Metadata = { title: "Quotation" };

export default async function QuotationPage({ params }: PageProps<"/quotations/[id]">) {
  const s = await requireStaff("finance.view");
  const { id } = await params;
  const [{ quotation: q, items }, company] = await Promise.all([getQuotation(id), companySettings(s.orgId)]);
  if (!q) notFound();
  const manage = can(s.role, "finance.manage");
  const editable = !["accepted", "rejected", "expired"].includes(q.status);
  const timeline = [
    q.sent_at && `Sent ${formatDateTime(q.sent_at)}`,
    q.viewed_at && `Viewed by client ${formatDateTime(q.viewed_at)}`,
    q.responded_at && `${q.status === "accepted" ? "Accepted" : "Declined"} ${formatDateTime(q.responded_at)}${q.client_response_note ? ` — “${q.client_response_note}”` : ""}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        title={q.number}
        description={q.title}
        breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label: q.number }]}
        meta={<><StatusBadge def={QUOTATION_STATUS} value={q.status} />{timeline.map((t) => <span key={t} className="text-xs text-muted-foreground">· {t}</span>)}</>}
        actions={<>
          <Button variant="outline" render={<Link href={`/print/quotation/${id}`} />}><Download /> PDF</Button>
          {manage && <>
            {editable && <Button variant="outline" render={<Link href={`/quotations/${id}/edit`} />}><Pencil /> Edit</Button>}
            <ConfirmAction trigger={<Button variant="outline"><Copy /> Duplicate</Button>} title="Duplicate quotation?" description="Creates a new draft with the same line items." confirmLabel="Duplicate" destructive={false} action={duplicateQuotation.bind(null, id)} />
            {q.status === "draft" && (q.client_id ? (
              <ConfirmAction trigger={<Button><Send /> Mark as sent</Button>} title="Share with client?" description="The quotation becomes visible in the client's portal, where they can accept or decline it. No email is sent — email delivery isn't configured; share the PDF yourself if needed." confirmLabel="Mark as sent" destructive={false} action={setQuotationStatus.bind(null, id, "sent")} />
            ) : <Button disabled title="Convert the lead to a client to share via the portal"><Send /> Mark as sent</Button>)}
            {["sent", "viewed"].includes(q.status) && <>
              <ConfirmAction trigger={<Button variant="outline"><Check /> Accepted</Button>} title="Record acceptance?" description="Use this if the client accepted outside the portal." confirmLabel="Mark accepted" destructive={false} action={setQuotationStatus.bind(null, id, "accepted")} />
              <ConfirmAction trigger={<Button variant="outline"><X /> Rejected</Button>} title="Record rejection?" description="Marks the quotation as rejected." confirmLabel="Mark rejected" action={setQuotationStatus.bind(null, id, "rejected")} />
            </>}
            {q.status === "accepted" && q.client_id && <ConfirmAction trigger={<Button><Receipt /> Create invoice</Button>} title="Create invoice from quotation?" description="A draft invoice with the same line items will be created for you to review and issue." confirmLabel="Create draft invoice" destructive={false} action={quotationToInvoice.bind(null, id)} />}
            {(q.status === "draft" || can(s.role, "finance.delete")) && <ConfirmAction trigger={<Button variant="ghost" size="icon" aria-label="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>} title={`Delete ${q.number}?`} description="This permanently deletes the quotation." action={deleteQuotation.bind(null, id)} />}
          </>}
        </>}
      />
      {q.lead && !q.client_id && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">This quotation is for lead <strong>{q.lead.company_name}</strong>. Convert the lead to a client to share it via the portal or invoice it.</p>}
      <FinanceDocument kind="Quotation" number={q.number} title={q.title} company={company} party={q.client ?? (q.lead ? { company_name: q.lead.company_name } : null)} items={items} taxMode={q.tax_mode}
        meta={[{ label: "Date", value: formatDate(q.issue_date) }, { label: "Valid until", value: formatDate(q.valid_until) }, ...(q.project ? [{ label: "Project", value: q.project.code }] : [])]}
        totals={q} notes={q.description} terms={q.terms} paymentTerms={q.payment_terms} />
      {q.notes && <p className="mx-auto mt-4 max-w-4xl rounded-lg bg-muted/60 p-3 text-sm"><span className="font-medium">Internal notes:</span> {q.notes}</p>}
    </>
  );
}
