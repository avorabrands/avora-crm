"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, formToObject, ok, toActionError, unwrap, type ActionState } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { LEAD_STATUS, type LeadStatus } from "@/lib/constants";
import { activitySchema, convertSchema, leadSchema } from "./schema";

function toRow(v: ReturnType<typeof leadSchema.parse>) {
  const { "services[]": services, ...rest } = v;
  return { ...rest, services };
}

export async function createLead(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("leads.manage");
    const v = leadSchema.parse(formToObject(fd));
    const supabase = await createClient();
    const lead = unwrap(await supabase.from("leads").insert({ ...toRow(v), organization_id: s.orgId, created_by: s.userId }).select("id, code").single());
    await logActivity(supabase, s, { entityType: "lead", entityId: lead.id, action: "created", summary: `Created lead ${lead.code} · ${v.company_name}` });
    revalidatePath("/leads");
    return ok(`Lead ${lead.code} created`, { id: lead.id });
  } catch (e) { return toActionError(e); }
}

export async function updateLead(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("leads.view");
    const v = leadSchema.parse(formToObject(fd));
    const supabase = await createClient();
    const before = unwrap(await supabase.from("leads").select("status").eq("id", id).single());
    unwrap(await supabase.from("leads").update(toRow(v)).eq("id", id).select("id").single());
    if (before.status !== v.status) {
      await supabase.from("lead_activities").insert({ organization_id: s.orgId, lead_id: id, type: "status_change", content: `Status changed from ${LEAD_STATUS.label[before.status as LeadStatus]} to ${LEAD_STATUS.label[v.status]}`, created_by: s.userId });
    }
    revalidatePath("/leads"); revalidatePath(`/leads/${id}`);
    return ok("Lead updated");
  } catch (e) { return toActionError(e); }
}

export async function setLeadStatus(id: string, status: string): Promise<ActionState> {
  try {
    const s = await authorizeStaff("leads.view");
    if (!LEAD_STATUS.values.includes(status as LeadStatus)) return fail("Invalid status");
    const supabase = await createClient();
    const lead = unwrap(await supabase.from("leads").select("status, converted_client_id, company_name").eq("id", id).single());
    if (lead.status === status) return ok();
    if (lead.converted_client_id && status !== "won") return fail("This lead has been converted to a client and can't leave Won.");
    unwrap(await supabase.from("leads").update({ status }).eq("id", id).select("id").single());
    await supabase.from("lead_activities").insert({ organization_id: s.orgId, lead_id: id, type: "status_change", content: `Status changed from ${LEAD_STATUS.label[lead.status as LeadStatus]} to ${LEAD_STATUS.label[status as LeadStatus]}`, created_by: s.userId });
    await logActivity(supabase, s, { entityType: "lead", entityId: id, action: "status_changed", summary: `${lead.company_name} moved to ${LEAD_STATUS.label[status as LeadStatus]}` });
    revalidatePath("/leads"); revalidatePath(`/leads/${id}`);
    return ok(status === "won" ? "Marked as won — convert it to a client when ready" : `Moved to ${LEAD_STATUS.label[status as LeadStatus]}`);
  } catch (e) { return toActionError(e); }
}

export async function deleteLead(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("leads.delete");
    const supabase = await createClient();
    unwrap(await supabase.from("leads").delete().eq("id", id).select("id").single());
    revalidatePath("/leads");
    return ok("Lead deleted");
  } catch (e) { return toActionError(e); }
}

export async function addLeadActivity(leadId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("leads.view");
    const v = activitySchema.parse(formToObject(fd));
    const supabase = await createClient();
    unwrap(await supabase.from("lead_activities").insert({ ...v, organization_id: s.orgId, lead_id: leadId, created_by: s.userId }).select("id").single());
    if (v.follow_up_date) await supabase.from("leads").update({ next_follow_up: v.follow_up_date }).eq("id", leadId);
    revalidatePath(`/leads/${leadId}`);
    return ok(v.follow_up_date ? "Saved and follow-up scheduled" : "Activity added");
  } catch (e) { return toActionError(e); }
}

/** Won lead → client (+ primary contact, optional project) — one DB transaction via convert_lead(). */
export async function convertLead(leadId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let clientId: string;
  try {
    await authorizeStaff("leads.manage");
    const v = convertSchema.parse(formToObject(fd));
    const supabase = await createClient();
    const res = unwrap<{ client_id: string }>(await supabase.rpc("convert_lead", {
      p_lead: leadId,
      p_project_name: v.create_project ? v.project_name : null,
      p_category: v.category,
      p_budget: v.budget,
    }));
    clientId = res.client_id;
    revalidatePath("/leads"); revalidatePath("/clients"); revalidatePath("/projects");
  } catch (e) { return toActionError(e); }
  redirect(`/clients/${clientId}`);
}
