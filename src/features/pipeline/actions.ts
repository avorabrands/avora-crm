"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, formToObject, ok, toActionError, unwrap, zDate, zEnum, zMoney, zRequired, zUuid, type ActionState } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { OPPORTUNITY_STAGE, type OpportunityStage } from "@/lib/constants";

const schema = z.object({
  title: zRequired("Deal title"),
  lead_id: zUuid,
  client_id: zUuid,
  value: zMoney,
  stage: zEnum(OPPORTUNITY_STAGE.values, "Stage").default("new"),
  assigned_to: zUuid,
  next_follow_up: zDate,
  expected_close_date: zDate,
}).refine((v) => v.lead_id || v.client_id, { message: "Link a lead or a client", path: ["lead_id"] });

export async function saveOpportunity(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("pipeline.view");
    const v = schema.parse(formToObject(fd));
    const row = { ...v, value: v.value ?? 0, closed_at: ["won", "lost"].includes(v.stage) ? new Date().toISOString() : null };
    const supabase = await createClient();
    if (id) unwrap(await supabase.from("opportunities").update(row).eq("id", id).select("id").single());
    else {
      const o = unwrap(await supabase.from("opportunities").insert({ ...row, organization_id: s.orgId, created_by: s.userId }).select("id").single());
      await logActivity(supabase, s, { entityType: "opportunity", entityId: o.id, action: "created", summary: `Deal “${v.title}” added to pipeline`, clientId: v.client_id });
    }
    revalidatePath("/pipeline");
    return ok(id ? "Deal updated" : "Deal added");
  } catch (e) { return toActionError(e); }
}

export async function moveOpportunity(id: string, stage: string): Promise<ActionState> {
  try {
    const s = await authorizeStaff("pipeline.view");
    if (!OPPORTUNITY_STAGE.values.includes(stage as OpportunityStage)) return fail("Invalid stage");
    const supabase = await createClient();
    const o = unwrap(await supabase.from("opportunities").select("title, stage, value, lead_id, client_id").eq("id", id).single());
    if (stage === "won" && Number(o.value) <= 0) return fail("Add a deal value before marking it won.");
    unwrap(await supabase.from("opportunities").update({ stage, closed_at: ["won", "lost"].includes(stage) ? new Date().toISOString() : null }).eq("id", id).select("id").single());
    // keep the linked lead in step for won/lost/quotation stages
    if (o.lead_id && ["won", "lost", "quotation_sent", "negotiation", "discussion"].includes(stage)) {
      const { data: lead } = await supabase.from("leads").select("converted_client_id").eq("id", o.lead_id).single();
      if (!lead?.converted_client_id) await supabase.from("leads").update({ status: stage }).eq("id", o.lead_id);
    }
    await logActivity(supabase, s, { entityType: "opportunity", entityId: id, action: "stage_changed", summary: `“${o.title}” moved from ${OPPORTUNITY_STAGE.label[o.stage as OpportunityStage]} to ${OPPORTUNITY_STAGE.label[stage as OpportunityStage]}`, clientId: o.client_id, metadata: { from: o.stage, to: stage } });
    revalidatePath("/pipeline"); revalidatePath("/leads");
    return ok(stage === "won" && o.lead_id && !o.client_id ? "Won! Convert the lead to a client from its page." : `Moved to ${OPPORTUNITY_STAGE.label[stage as OpportunityStage]}`);
  } catch (e) { return toActionError(e); }
}

export async function deleteOpportunity(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("pipeline.view");
    const supabase = await createClient();
    unwrap(await supabase.from("opportunities").delete().eq("id", id).select("id").single());
    revalidatePath("/pipeline");
    return ok("Deal removed");
  } catch (e) { return toActionError(e); }
}
