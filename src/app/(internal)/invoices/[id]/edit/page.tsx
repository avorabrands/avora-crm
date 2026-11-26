import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { editorData } from "@/features/finance/editor-data";
import { getInvoice } from "@/features/finance/queries";
import { saveInvoice } from "@/features/finance/invoice-actions";
import { InvoiceEditor } from "@/features/finance/components/editors";
import type { TaxMode } from "@/lib/tax";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoice({ params }: PageProps<"/invoices/[id]/edit">) {
  const s = await requireStaff("finance.manage");
  const { id } = await params;
  const [{ invoice: inv, items }, d] = await Promise.all([getInvoice(id), editorData(s.orgId)]);
  if (!inv) notFound();
  if (inv.status === "cancelled" || Number(inv.amount_paid) > 0) redirect(`/invoices/${id}`);
  return (
    <>
      <PageHeader title={`Edit ${inv.number}`} breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: inv.number, href: `/invoices/${id}` }, { label: "Edit" }]} />
      <InvoiceEditor action={saveInvoice.bind(null, id)} cancelHref={`/invoices/${id}`} {...d} defaultTemplate={d.invoiceTemplate} inv={{ ...inv, tax_mode: inv.tax_mode as TaxMode }}
        items={items.map((i) => ({ name: i.name, description: i.description, hsn_sac: i.hsn_sac, quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount_pct: Number(i.discount_pct), tax_rate: Number(i.tax_rate) }))} />
    </>
  );
}
