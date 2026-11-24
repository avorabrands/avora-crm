import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { companySettings } from "@/features/common/lookups";
import { getQuotation } from "@/features/finance/queries";
import { FinanceDocument } from "@/features/finance/components/document";
import { formatDate } from "@/lib/format";
import { PrintBar } from "../../print-bar";
import { portalMe } from "@/features/portal/queries";

export default async function PrintQuotation({ params }: PageProps<"/print/quotation/[id]">) {
  const s = await requireSession();
  const { id } = await params;
  const [{ quotation: q, items }, company] = await Promise.all([getQuotation(id), companySettings(s.orgId)]);
  const me = s.role === "client" ? await portalMe() : null;
  if (!q) notFound();
  return (
    <>
      <PrintBar back={s.role === "client" ? `/portal/quotations/${id}` : `/quotations/${id}`} />
      <FinanceDocument kind="Quotation" number={q.number} title={q.title} company={company} party={me ?? q.client ?? (q.lead ? { company_name: q.lead.company_name } : null)} items={items} taxMode={q.tax_mode}
        meta={[{ label: "Date", value: formatDate(q.issue_date) }, { label: "Valid until", value: formatDate(q.valid_until) }]}
        totals={q} notes={q.description} terms={q.terms} paymentTerms={q.payment_terms} />
    </>
  );
}
