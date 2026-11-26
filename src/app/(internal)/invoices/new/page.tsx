import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { suggestTaxMode } from "@/lib/tax";
import { editorData } from "@/features/finance/editor-data";
import { saveInvoice } from "@/features/finance/invoice-actions";
import { InvoiceEditor } from "@/features/finance/components/editors";
import { daysFromTodayISO } from "@/lib/format";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoice({ searchParams }: PageProps<"/invoices/new">) {
  const s = await requireStaff("finance.manage");
  const sp = await searchParams;
  const d = await editorData(s.orgId);
  const client = typeof sp.client === "string" ? sp.client : "";
  const project = typeof sp.project === "string" ? sp.project : null;
  return (
    <>
      <PageHeader title="New invoice" description="Saved as a draft. Issue it when ready — then it appears in the client portal." breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "New" }]} />
      <InvoiceEditor action={saveInvoice.bind(null, null)} cancelHref="/invoices" {...d} defaultTemplate={d.invoiceTemplate} defaultProjectId={project ?? undefined}
        inv={client ? { client_id: client, project_id: project, milestone_id: null, invoice_date: daysFromTodayISO(0), due_date: daysFromTodayISO(15), tax_mode: suggestTaxMode(d.companyState, d.clients.find((c) => c.value === client)?.state), notes: null, terms: d.settings?.default_terms ?? null } : undefined} />
    </>
  );
}
