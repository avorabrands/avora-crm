import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { companySettings } from "@/features/common/lookups";
import { getPayment } from "@/features/finance/queries";
import { ReceiptDocument } from "@/features/finance/components/document";
import { PrintBar } from "../../print-bar";
import { portalMe } from "@/features/portal/queries";

export default async function PrintReceipt({ params }: PageProps<"/print/receipt/[id]">) {
  const s = await requireSession();
  const { id } = await params;
  const [payment, company] = await Promise.all([getPayment(id), companySettings(s.orgId)]);
  if (!payment) notFound();
  const me = s.role === "client" ? await portalMe() : null;
  return (<><PrintBar back={s.role === "client" ? "/portal/payments" : "/payments"} /><ReceiptDocument company={company} payment={me ? { ...payment, client: me } : payment} /></>);
}
