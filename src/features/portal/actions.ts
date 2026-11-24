"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, toActionError, type ActionState } from "@/lib/actions";

async function requirePortal() {
  const s = await authorize();
  if (s.role !== "client") throw { code: "42501", message: "Only client portal users can do this." };
  return s;
}

/** Client approves or requests a revision. All checks happen in the SECURITY DEFINER RPC. */
export async function reviewDeliverable(deliverableId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requirePortal();
    const decision = fd.get("decision") === "approved" ? "approved" : "revision_requested";
    const comment = String(fd.get("comment") ?? "").trim();
    if (decision === "revision_requested" && !comment) return fail("Please describe the changes you need.", { comment: "Required for revisions" });
    if (comment.length > 5000) return fail("Feedback is too long.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("client_review_deliverable", { p_deliverable: deliverableId, p_decision: decision, p_comment: comment || null });
    if (error) throw error;
    revalidatePath("/portal", "layout");
    return ok(decision === "approved" ? "Approved — thank you! The Avora team has been notified." : "Revision requested — the Avora team has been notified.");
  } catch (e) { return toActionError(e); }
}

export async function respondToQuotation(quotationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requirePortal();
    const accept = fd.get("decision") === "accept";
    const supabase = await createClient();
    const { error } = await supabase.rpc("client_respond_quotation", { p_quotation: quotationId, p_accept: accept, p_note: String(fd.get("note") ?? "") || null });
    if (error) throw error;
    revalidatePath(`/portal/quotations/${quotationId}`); revalidatePath("/portal/quotations");
    return ok(accept ? "Quotation accepted. We'll be in touch with next steps." : "Response sent.");
  } catch (e) { return toActionError(e); }
}

export async function markQuotationViewed(quotationId: string) {
  const s = await authorize();
  if (s.role !== "client") return;
  const supabase = await createClient();
  await supabase.rpc("client_mark_quotation_viewed", { p_quotation: quotationId });
}
