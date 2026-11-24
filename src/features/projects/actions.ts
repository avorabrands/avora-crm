"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, formToObject, ok, toActionError, unwrap, type ActionState } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { PROJECT_STATUS, type ProjectStatus } from "@/lib/constants";
import { financialsSchema, milestoneSchema, projectSchema } from "./schema";

function split(v: ReturnType<typeof projectSchema.parse>) {
  const { "member_ids[]": memberIds, progress, ...row } = v;
  return { row: row.progress_mode === "manual" ? { ...row, progress } : row, memberIds };
}

export async function createProject(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const s = await authorizeStaff("projects.manage");
    const { row, memberIds } = split(projectSchema.parse(formToObject(fd)));
    const supabase = await createClient();
    const p = unwrap(await supabase.from("projects").insert({ ...row, organization_id: s.orgId, created_by: s.userId }).select("id, code, name").single());
    id = p.id;
    if (memberIds.length) await supabase.from("project_members").insert(memberIds.map((u) => ({ project_id: p.id, user_id: u, organization_id: s.orgId })));
    await logActivity(supabase, s, { entityType: "project", entityId: p.id, action: "created", summary: `Project ${p.code} · ${p.name} created`, clientId: row.client_id, projectId: p.id, clientVisible: row.client_visible });
    revalidatePath("/projects");
  } catch (e) { return toActionError(e); }
  redirect(`/projects/${id}`);
}

export async function updateProject(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("projects.manage");
    const { row, memberIds } = split(projectSchema.parse(formToObject(fd)));
    const supabase = await createClient();
    const before = unwrap(await supabase.from("projects").select("status").eq("id", id).single());
    unwrap(await supabase.from("projects").update(row).eq("id", id).select("id").single());
    // sync team
    const { data: current } = await supabase.from("project_members").select("user_id").eq("project_id", id);
    const cur = new Set((current ?? []).map((m) => m.user_id as string));
    const next = new Set(memberIds);
    const toAdd = memberIds.filter((u) => !cur.has(u));
    const toRemove = [...cur].filter((u) => !next.has(u));
    if (toAdd.length) await supabase.from("project_members").insert(toAdd.map((u) => ({ project_id: id, user_id: u, organization_id: s.orgId })));
    if (toRemove.length) await supabase.from("project_members").delete().eq("project_id", id).in("user_id", toRemove);
    if (before.status !== row.status) {
      await logActivity(supabase, s, { entityType: "project", entityId: id, action: "status_changed", summary: `Project status changed to ${PROJECT_STATUS.label[row.status]}`, clientId: row.client_id, projectId: id, clientVisible: true });
    }
    revalidatePath("/projects"); revalidatePath(`/projects/${id}`);
    return ok("Project updated");
  } catch (e) { return toActionError(e); }
}

export async function setProjectStatus(id: string, status: string): Promise<ActionState> {
  try {
    const s = await authorizeStaff("projects.manage");
    if (!PROJECT_STATUS.values.includes(status as ProjectStatus)) return fail("Invalid status");
    const supabase = await createClient();
    const p = unwrap(await supabase.from("projects").update({ status }).eq("id", id).select("client_id").single());
    await logActivity(supabase, s, { entityType: "project", entityId: id, action: "status_changed", summary: `Project status changed to ${PROJECT_STATUS.label[status as ProjectStatus]}`, clientId: p.client_id, projectId: id, clientVisible: true });
    revalidatePath(`/projects/${id}`); revalidatePath("/projects");
    return ok(`Status: ${PROJECT_STATUS.label[status as ProjectStatus]}`);
  } catch (e) { return toActionError(e); }
}

export async function deleteProject(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("projects.delete");
    const supabase = await createClient();
    const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("project_id", id).not("status", "in", "(draft,cancelled)");
    if (count) return fail("This project has issued invoices. Cancel it instead of deleting.");
    unwrap(await supabase.from("projects").delete().eq("id", id).select("id").single());
    revalidatePath("/projects");
    return ok("Project deleted");
  } catch (e) { return toActionError(e); }
}

// ── Milestones ───────────────────────────────────────────────────────────
export async function saveMilestone(projectId: string, milestoneId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("projects.manage");
    const v = milestoneSchema.parse(formToObject(fd));
    const supabase = await createClient();
    const patch = { ...v, completed_at: v.status === "completed" ? new Date().toISOString() : null };
    if (milestoneId) unwrap(await supabase.from("project_milestones").update(patch).eq("id", milestoneId).select("id").single());
    else {
      const { count } = await supabase.from("project_milestones").select("id", { count: "exact", head: true }).eq("project_id", projectId);
      unwrap(await supabase.from("project_milestones").insert({ ...patch, project_id: projectId, organization_id: s.orgId, position: count ?? 0 }).select("id").single());
    }
    revalidatePath(`/projects/${projectId}`);
    return ok(milestoneId ? "Milestone updated" : "Milestone added");
  } catch (e) { return toActionError(e); }
}

export async function deleteMilestone(projectId: string, id: string): Promise<ActionState> {
  try {
    await authorizeStaff("projects.manage");
    const supabase = await createClient();
    unwrap(await supabase.from("project_milestones").delete().eq("id", id).select("id").single());
    revalidatePath(`/projects/${projectId}`);
    return ok("Milestone removed");
  } catch (e) { return toActionError(e); }
}

// ── Internal profitability (admin) ───────────────────────────────────────
export async function saveProjectFinancials(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("profitability.view");
    const v = financialsSchema.parse(formToObject(fd));
    const supabase = await createClient();
    unwrap(await supabase.from("project_financials").upsert({ project_id: projectId, organization_id: s.orgId, estimated_cost: v.estimated_cost ?? 0, actual_cost: v.actual_cost ?? 0, notes: v.notes, updated_at: new Date().toISOString() }).select("project_id").single());
    revalidatePath(`/projects/${projectId}`);
    return ok("Cost tracking saved");
  } catch (e) { return toActionError(e); }
}
