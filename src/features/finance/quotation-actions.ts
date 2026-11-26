"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, formToObject, ok, toActionError, unwrap, type ActionState } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { asTemplate } from "@/lib/doc-templates";
import { QUOTATION_STATUS } from "@/lib/constants";
import { quotationSchema } from "./schema";

export async function saveQuotation(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  let savedId: string;
  try {
    const s = await authorizeStaff("finance.manage");
    const { items, ...header } = quotationSchema.parse(formToObject(fd));
    const supabase = await createClient();
    if (id) {
      const existing = unwrap(await supabase.from("quotations").select("status").eq("id", id).single());
      if (["accepted", "rejected", "expired"].includes(existing.status)) return fail(`A ${existing.status} quotation can't be edited. Duplicate it instead.`);
    }
    // header + line items in one transaction (save_quotation, migration 0009)
    savedId = unwrap<string>(await supabase.rpc("save_quotation", { p_id: id, p_org: s.orgId, p_header: header, p_items: items }));
    if (!id) {
      const { data: q } = await supabase.from("quotations").select("number").eq("id", savedId).single();
      await logActivity(supabase, s, { entityType: "quotation", entityId: savedId, action: "created", summary: `Quotation ${q?.number ?? ""} drafted · ${header.title}`, clientId: header.client_id, projectId: header.project_id });
    }
    revalidatePath("/quotations");
  } catch (e) { return toActionError(e); }
  redirect(`/quotations/${savedId}`);
}

export async function setQuotationStatus(id: string, status: "sent" | "draft" | "accepted" | "rejected"): Promise<ActionState> {
  try {
    const s = await authorizeStaff("finance.manage");
    const supabase = await createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "accepted" || status === "rejected") patch.responded_at = new Date().toISOString();
    const q = unwrap(await supabase.from("quotations").update(patch).eq("id", id).select("number, client_id, project_id").single());
    await logActivity(supabase, s, { entityType: "quotation", entityId: id, action: status, summary: `Quotation ${q.number} marked ${QUOTATION_STATUS.label[status].toLowerCase()}`, clientId: q.client_id, projectId: q.project_id, clientVisible: status !== "draft" });
    revalidatePath(`/quotations/${id}`); revalidatePath("/quotations");
    return ok(status === "sent" ? "Marked as sent — it's now visible in the client portal. (Email delivery isn't configured.)" : `Marked ${QUOTATION_STATUS.label[status].toLowerCase()}`);
  } catch (e) { return toActionError(e); }
}

export async function deleteQuotation(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("finance.manage");
    const supabase = await createClient();
    unwrap(await supabase.from("quotations").delete().eq("id", id).select("id").single());
    revalidatePath("/quotations");
    return ok("Quotation deleted");
  } catch (e) { return toActionError(e); }
}

export async function duplicateQuotation(id: string): Promise<ActionState> {
  let newId: string;
  try {
    const s = await authorizeStaff("finance.manage");
    const supabase = await createClient();
    const q = unwrap(await supabase.from("quotations").select("*, quotation_items(*)").eq("id", id).single());
    const copy = unwrap(await supabase.from("quotations").insert({
      organization_id: s.orgId, client_id: q.client_id, lead_id: q.lead_id, project_id: q.project_id, title: `${q.title} (copy)`, description: q.description,
      tax_mode: q.tax_mode, payment_terms: q.payment_terms, terms: q.terms, notes: q.notes, created_by: s.userId,
    }).select("id").single());
    newId = copy.id;
    const items = (q.quotation_items as Record<string, unknown>[]).sort((a, b) => Number(a.position) - Number(b.position));
    if (items.length) await supabase.from("quotation_items").insert(items.map((it) => ({ organization_id: s.orgId, quotation_id: newId, position: it.position, name: it.name, description: it.description, quantity: it.quantity, unit_price: it.unit_price, discount_pct: it.discount_pct, tax_rate: it.tax_rate })));
    revalidatePath("/quotations");
  } catch (e) { return toActionError(e); }
  redirect(`/quotations/${newId}/edit`);
}

/** Accepted quotation → draft invoice with the same line items. */
export async function quotationToInvoice(id: string): Promise<ActionState> {
  let invoiceId: string;
  try {
    const s = await authorizeStaff("finance.manage");
    const supabase = await createClient();
    const q = unwrap(await supabase.from("quotations").select("*, quotation_items(*)").eq("id", id).single());
    if (!q.client_id) return fail("Convert the lead to a client before invoicing.");
    const inv = unwrap(await supabase.from("invoices").insert({
      organization_id: s.orgId, client_id: q.client_id, project_id: q.project_id, quotation_id: q.id, tax_mode: q.tax_mode, template: q.template,
      terms: q.payment_terms, notes: `Against quotation ${q.number}`, created_by: s.userId,
    }).select("id, number").single());
    invoiceId = inv.id;
    const items = (q.quotation_items as Record<string, unknown>[]).sort((a, b) => Number(a.position) - Number(b.position));
    unwrap(await supabase.from("invoice_items").insert(items.map((it) => ({ organization_id: s.orgId, invoice_id: inv.id, position: it.position, name: it.name, description: it.description, quantity: it.quantity, unit_price: it.unit_price, discount_pct: it.discount_pct, tax_rate: it.tax_rate }))).select("id"));
    await logActivity(supabase, s, { entityType: "invoice", entityId: inv.id, action: "created", summary: `Invoice ${inv.number} drafted from quotation ${q.number}`, clientId: q.client_id, projectId: q.project_id });
    revalidatePath("/invoices");
  } catch (e) { return toActionError(e); }
  redirect(`/invoices/${invoiceId}`);
}

/** Change only the print layout — allowed at any status, it never touches amounts. */
export async function setQuotationTemplate(id: string, template: string): Promise<ActionState> {
  try {
    await authorizeStaff("finance.manage");
    const supabase = await createClient();
    unwrap(await supabase.from("quotations").update({ template: asTemplate(template) }).eq("id", id).select("id").single());
    revalidatePath(`/quotations/${id}`); revalidatePath(`/print/quotation/${id}`); revalidatePath(`/portal/quotations/${id}`);
    return ok("Template updated");
  } catch (e) { return toActionError(e); }
}
