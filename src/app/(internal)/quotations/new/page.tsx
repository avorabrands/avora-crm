import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { suggestTaxMode } from "@/lib/tax";
import { editorData } from "@/features/finance/editor-data";
import { saveQuotation } from "@/features/finance/quotation-actions";
import { QuotationEditor } from "@/features/finance/components/editors";

export const metadata: Metadata = { title: "New quotation" };

export default async function NewQuotation({ searchParams }: PageProps<"/quotations/new">) {
  const s = await requireStaff("finance.manage");
  const sp = await searchParams;
  const d = await editorData(s.orgId);
  const client = typeof sp.client === "string" ? sp.client : null;
  const project = typeof sp.project === "string" ? sp.project : null;
  const lead = typeof sp.lead === "string" ? sp.lead : null;
  return (
    <>
      <PageHeader title="New quotation" description="Numbering, totals and GST are calculated automatically." breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label: "New" }]} />
      <QuotationEditor action={saveQuotation.bind(null, null)} cancelHref="/quotations" {...d}
        q={(client || project || lead) ? { client_id: client, lead_id: lead, project_id: project, title: "", description: null, issue_date: new Date().toISOString().slice(0, 10), valid_until: null, tax_mode: suggestTaxMode(d.companyState, d.clients.find((c) => c.value === client)?.state), payment_terms: d.settings?.default_payment_terms ?? null, terms: d.settings?.default_terms ?? null, notes: null } : undefined} />
    </>
  );
}
