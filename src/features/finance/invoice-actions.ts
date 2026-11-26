"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, formToObject, ok, toActionError, unwrap, type ActionState } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { asTemplate } from "@/lib/doc-templates";
import { formatINR } from "@/lib/format";
import { agreementSchema, invoiceSchema, paymentSchema } from "./schema";

export async function saveInvoice(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  let savedId: string;
  try {
    const s = await authorizeStaff("finance.manage");
    const { items, ...header } = invoiceSchema.parse(formToObject(fd));
    const supabase = await createClient();
    if (id) {
      const existing = unwrap(await supabase.from("invoices").select("status, amount_paid").eq("id", id).single());
      if (existing.status === "cancelled") return fail("Cancelled invoices can't be edited.");
      if (Number(existing.amount_paid) > 0) return fail("This invoice has payments recorded, so its amounts are locked. Issue a new invoice for changes.");
    }
    // header + line items in one transaction (save_invoice, migration 0009)
    savedId = unwrap<string>(await supabase.rpc("save_invoice", { p_id: id, p_org: s.orgId, p_header: header, p_items: items }));
    if (!id) {
      const { data: inv } = await supabase.from("invoices").select("number").eq("id", savedId).single();
      await logActivity(supabase, s, { entityType: "invoice", entityId: savedId, action: "created", summary: `Invoice ${inv?.number ?? ""} drafted`, clientId: header.client_id, projectId: header.project_id });
    }
    revalidatePath("/invoices");
  } catch (e) { return toActionError(e); }
  redirect(`/invoices/${savedId}`);
}

export async function issueInvoice(id: string): Promise<ActionState> {
  try {
    const s = await authorizeStaff("finance.manage");
    const supabase = await createClient();
    const inv = unwrap(await supabase.from("invoices").select("status, total, number, client_id, project_id").eq("id", id).single());
    if (inv.status !== "draft") return fail("Only draft invoices can be issued.");
    if (Number(inv.total) <= 0) return fail("Add line items before issuing the invoice.");
    unwrap(await supabase.from("invoices").update({ status: "unpaid", issued_at: new Date().toISOString() }).eq("id", id).select("id").single());
    await logActivity(supabase, s, { entityType: "invoice", entityId: id, action: "issued", summary: `Invoice ${inv.number} issued for ${formatINR(inv.total)}`, clientId: inv.client_id, projectId: inv.project_id, clientVisible: true });
    revalidatePath(`/invoices/${id}`); revalidatePath("/invoices");
    return ok("Invoice issued — visible in the client portal. (Email delivery isn't configured.)");
  } catch (e) { return toActionError(e); }
}

export async function cancelInvoice(id: string): Promise<ActionState> {
  try {
    const s = await authorizeStaff("finance.manage");
    const supabase = await createClient();
    const inv = unwrap(await supabase.from("invoices").select("amount_paid, number, client_id").eq("id", id).single());
    if (Number(inv.amount_paid) > 0) return fail("Invoices with recorded payments can't be cancelled. Delete or refund the payments first.");
    unwrap(await supabase.from("invoices").update({ status: "cancelled" }).eq("id", id).select("id").single());
    await logActivity(supabase, s, { entityType: "invoice", entityId: id, action: "cancelled", summary: `Invoice ${inv.number} cancelled`, clientId: inv.client_id });
    revalidatePath(`/invoices/${id}`); revalidatePath("/invoices");
    return ok("Invoice cancelled");
  } catch (e) { return toActionError(e); }
}

export async function deleteInvoice(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("finance.delete");
    const supabase = await createClient();
    const { data, error } = await supabase.from("invoices").delete().eq("id", id).in("status", ["draft", "cancelled"]).select("id");
    if (error) throw error;
    if (!data?.length) return fail("Only draft or cancelled invoices can be deleted.");
    revalidatePath("/invoices");
    return ok("Invoice deleted");
  } catch (e) { return toActionError(e); }
}

export async function recordPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("finance.manage");
    const v = paymentSchema.parse(formToObject(fd));
    const supabase = await createClient();
    let clientId = v.client_id;
    let projectId = v.project_id;
    if (v.invoice_id) {
      const inv = unwrap(await supabase.from("invoices").select("client_id, project_id, balance_due, status").eq("id", v.invoice_id).single());
      if (inv.status === "draft") return fail("Issue the invoice before recording payments against it.", { invoice_id: "Invoice is still a draft" });
      if (v.amount > Number(inv.balance_due)) return fail(`Amount exceeds the outstanding balance of ${formatINR(inv.balance_due)}.`, { amount: `Max ${formatINR(inv.balance_due)}` });
      clientId = inv.client_id; projectId = projectId ?? inv.project_id;
    }
    const pay = unwrap(await supabase.from("payments").insert({ ...v, client_id: clientId, project_id: projectId, organization_id: s.orgId, recorded_by: s.userId }).select("id, receipt_number").single());
    await logActivity(supabase, s, { entityType: "payment", entityId: pay.id, action: "recorded", summary: `Payment of ${formatINR(v.amount)} received (${pay.receipt_number})`, clientId, projectId, clientVisible: true });
    revalidatePath("/payments"); revalidatePath("/invoices"); if (v.invoice_id) revalidatePath(`/invoices/${v.invoice_id}`);
    return ok(`Payment recorded · receipt ${pay.receipt_number}`, { id: pay.id });
  } catch (e) { return toActionError(e); }
}

export async function deletePayment(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("finance.delete");
    const supabase = await createClient();
    unwrap(await supabase.from("payments").delete().eq("id", id).select("id").single());
    revalidatePath("/payments"); revalidatePath("/invoices");
    return ok("Payment deleted — invoice balance updated");
  } catch (e) { return toActionError(e); }
}

export async function saveAgreement(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("finance.manage");
    const raw = formToObject(fd);
    const v = agreementSchema.parse(raw);
    const supabase = await createClient();
    let agreementId = id;
    if (id) unwrap(await supabase.from("agreements").update(v).eq("id", id).select("id").single());
    else agreementId = unwrap(await supabase.from("agreements").insert({ ...v, organization_id: s.orgId, created_by: s.userId }).select("id").single()).id;

    const file = fd.get("file");
    if (file instanceof File && file.size > 0) {
      const { uploadFile } = await import("@/features/files/upload");
      const f = await uploadFile(supabase, s, file, { clientId: v.client_id, projectId: v.project_id, folder: "Agreements", category: "agreement", clientVisible: v.client_visible });
      await supabase.from("agreements").update({ file_id: f.id }).eq("id", agreementId!);
    }
    await logActivity(supabase, s, { entityType: "agreement", entityId: agreementId, action: id ? "updated" : "created", summary: `Agreement “${v.title}” ${id ? "updated" : "added"} (${v.status})`, clientId: v.client_id, projectId: v.project_id, clientVisible: v.client_visible && v.status !== "draft" });
    revalidatePath("/agreements"); revalidatePath(`/clients/${v.client_id}`);
    return ok(id ? "Agreement updated" : "Agreement added");
  } catch (e) { return toActionError(e); }
}

export async function deleteAgreement(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("finance.manage");
    const supabase = await createClient();
    unwrap(await supabase.from("agreements").delete().eq("id", id).select("id").single());
    revalidatePath("/agreements");
    return ok("Agreement deleted");
  } catch (e) { return toActionError(e); }
}

/** Change only the print layout — allowed at any status, it never touches amounts. */
export async function setInvoiceTemplate(id: string, template: string): Promise<ActionState> {
  try {
    await authorizeStaff("finance.manage");
    const supabase = await createClient();
    unwrap(await supabase.from("invoices").update({ template: asTemplate(template) }).eq("id", id).select("id").single());
    revalidatePath(`/invoices/${id}`); revalidatePath(`/print/invoice/${id}`); revalidatePath(`/portal/invoices/${id}`);
    return ok("Template updated");
  } catch (e) { return toActionError(e); }
}
