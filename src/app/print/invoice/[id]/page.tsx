import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { companySettings } from "@/features/common/lookups";
import { getInvoice } from "@/features/finance/queries";
import { FinanceDocument } from "@/features/finance/components/document";
import { formatDate } from "@/lib/format";
import { PrintBar } from "../../print-bar";
import { portalMe } from "@/features/portal/queries";

export default async function PrintInvoice({ params }: PageProps<"/print/invoice/[id]">) {
  const s = await requireSession();
  const { id } = await params;
  const [{ invoice: inv, items }, company] = await Promise.all([getInvoice(id), companySettings(s.orgId)]);
  const me = s.role === "client" ? await portalMe() : null;
  if (!inv) notFound();
  return (
    <>
      <PrintBar back={s.role === "client" ? `/portal/invoices/${id}` : `/invoices/${id}`} />
      <FinanceDocument kind="Tax Invoice" number={inv.number} title={inv.project?.name} company={company} party={me ?? inv.client} items={items} taxMode={inv.tax_mode}
        meta={[{ label: "Invoice date", value: formatDate(inv.invoice_date) }, { label: "Due date", value: formatDate(inv.due_date) }, ...(inv.quotation ? [{ label: "Quotation", value: inv.quotation.number }] : [])]}
        totals={inv} notes={inv.notes} terms={inv.terms ?? company?.default_terms} />
    </>
  );
}
