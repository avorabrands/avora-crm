import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { editorData } from "@/features/finance/editor-data";
import { getQuotation } from "@/features/finance/queries";
import { saveQuotation } from "@/features/finance/quotation-actions";
import { QuotationEditor } from "@/features/finance/components/editors";
import type { TaxMode } from "@/lib/tax";

export const metadata: Metadata = { title: "Edit quotation" };

export default async function EditQuotation({ params }: PageProps<"/quotations/[id]/edit">) {
  const s = await requireStaff("finance.manage");
  const { id } = await params;
  const [{ quotation: q, items }, d] = await Promise.all([getQuotation(id), editorData(s.orgId)]);
  if (!q) notFound();
  if (["accepted", "rejected", "expired"].includes(q.status)) redirect(`/quotations/${id}`);
  return (
    <>
      <PageHeader title={`Edit ${q.number}`} breadcrumbs={[{ label: "Quotations", href: "/quotations" }, { label: q.number, href: `/quotations/${id}` }, { label: "Edit" }]} />
      <QuotationEditor action={saveQuotation.bind(null, id)} cancelHref={`/quotations/${id}`} {...d} defaultTemplate={d.quotationTemplate} q={{ ...q, tax_mode: q.tax_mode as TaxMode }}
        items={items.map((i) => ({ name: i.name, description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount_pct: Number(i.discount_pct), tax_rate: Number(i.tax_rate) }))} />
    </>
  );
}
