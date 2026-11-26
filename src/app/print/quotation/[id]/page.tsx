import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { companySettings } from "@/features/common/lookups";
import { getQuotation } from "@/features/finance/queries";
import { documentFileName, documentSubject } from "@/lib/doc-templates";
import { FinanceDocument } from "@/features/finance/components/document";
import { formatDate } from "@/lib/format";
import { PrintBar } from "../../print-bar";
import { asTemplate } from "@/lib/doc-templates";
import { can } from "@/lib/auth/permissions";
import { setQuotationTemplate } from "@/features/finance/quotation-actions";
import { leadPortalMe, portalMe } from "@/features/portal/queries";

/** The page title becomes the file name in "Save as PDF". */
export async function generateMetadata({ params }: PageProps<"/print/quotation/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { quotation: q, items } = await getQuotation(id);
  if (!q) return { title: "Quotation" };
  return { title: { absolute: documentFileName(`Quotation ${q.number}`, q.client?.company_name ?? q.lead?.company_name, documentSubject(q.title, items)) } };
}

export default async function PrintQuotation({ params, searchParams }: PageProps<"/print/quotation/[id]">) {
  const s = await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const [{ quotation: q, items }, company] = await Promise.all([getQuotation(id), companySettings(s.orgId)]);
  const me = s.role === "client" ? await portalMe() : null;
  const lead = s.role === "lead" ? await leadPortalMe() : null;
  if (!q) notFound();
  const staff = can(s.role, "finance.manage");
  // clients (and read-only staff) can preview other layouts via ?template=; managers save the choice
  const template = staff ? q.template : asTemplate(sp.template, q.template);
  return (
    <>
      <PrintBar template={template} save={staff ? setQuotationTemplate.bind(null, id) : undefined} back={s.role === "client" ? `/portal/quotations/${id}` : s.role === "lead" ? `/lead/quotations/${id}` : `/quotations/${id}`} />
      <FinanceDocument template={template} kind="Quotation" number={q.number} title={q.title} company={company} party={me ?? (lead ? { company_name: lead.company_name, contact_person: lead.contact_person, billing_address: lead.location, email: lead.email } : null) ?? q.client ?? (q.lead ? { company_name: q.lead.company_name } : null)} items={items} taxMode={q.tax_mode}
        meta={[{ label: "Date", value: formatDate(q.issue_date) }, { label: "Valid until", value: formatDate(q.valid_until) }]}
        totals={q} notes={q.description} terms={q.terms} paymentTerms={q.payment_terms} />
    </>
  );
}
