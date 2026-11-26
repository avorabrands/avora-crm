import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { QUOTATION_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { companySettings } from "@/features/common/lookups";
import { getQuotation } from "@/features/finance/queries";
import { FinanceDocument } from "@/features/finance/components/document";
import { markQuotationViewed, respondToQuotation } from "@/features/portal/actions";
import { portalMe } from "@/features/portal/queries";
import { QuotationResponse } from "@/features/portal/components";

export default async function PortalQuotation({ params }: PageProps<"/portal/quotations/[id]">) {
  const s = await requireClient();
  const { id } = await params;
  await markQuotationViewed(id);
  const [{ quotation: q, items }, company, me] = await Promise.all([getQuotation(id), companySettings(s.orgId), portalMe()]);
  if (!q) notFound();
  const open = ["sent", "viewed"].includes(q.status);
  return (
    <>
      <PageHeader title={q.number} description={q.title} breadcrumbs={[{ label: "Quotations", href: "/portal/quotations" }, { label: q.number }]} meta={<StatusBadge def={QUOTATION_STATUS} value={q.status} />}
        actions={<Button variant="outline" render={<Link href={`/print/quotation/${id}`} />}><Download /> Download PDF</Button>} />
      {open && <div className="mx-auto mb-6 max-w-4xl rounded-xl border bg-card p-4"><p className="mb-3 text-sm">Valid until <strong>{formatDate(q.valid_until)}</strong>. Ready to go ahead?</p><QuotationResponse action={respondToQuotation.bind(null, id)} /></div>}
      <FinanceDocument template={q.template} kind="Quotation" number={q.number} title={q.title} company={company} party={me} items={items} taxMode={q.tax_mode}
        meta={[{ label: "Date", value: formatDate(q.issue_date) }, { label: "Valid until", value: formatDate(q.valid_until) }]} totals={q} notes={q.description} terms={q.terms} paymentTerms={q.payment_terms} />
    </>
  );
}
