import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { INVOICE_STATUS } from "@/lib/constants";
import { invoiceTermsLabel } from "@/lib/doc-templates";
import { effectiveInvoiceStatus, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { companySettings } from "@/features/common/lookups";
import { getInvoice } from "@/features/finance/queries";
import { FinanceDocument } from "@/features/finance/components/document";
import { portalMe } from "@/features/portal/queries";

export default async function PortalInvoice({ params }: PageProps<"/portal/invoices/[id]">) {
  const s = await requireClient();
  const { id } = await params;
  const [{ invoice: inv, items }, company, me] = await Promise.all([getInvoice(id), companySettings(s.orgId), portalMe()]);
  if (!inv) notFound();
  return (
    <>
      <PageHeader title={inv.number} breadcrumbs={[{ label: "Invoices", href: "/portal/invoices" }, { label: inv.number }]} meta={<StatusBadge def={INVOICE_STATUS} value={effectiveInvoiceStatus(inv)} />}
        actions={<Button variant="outline" render={<Link href={`/print/invoice/${id}`} />}><Download /> Download PDF</Button>} />
      <FinanceDocument template={inv.template} kind="Tax Invoice" number={inv.number} title={inv.project?.name} company={company} party={me} items={items} taxMode={inv.tax_mode}
        meta={[{ label: "Invoice date", value: formatDate(inv.invoice_date) }, { label: "Terms", value: invoiceTermsLabel(inv.invoice_date, inv.due_date) }, { label: "Due date", value: formatDate(inv.due_date) }]} totals={inv} notes={inv.notes} terms={inv.terms ?? company?.default_terms} />
    </>
  );
}
