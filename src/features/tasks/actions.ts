"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { fail, formToObject, ok, toActionError, unwrap, type ActionState } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { TASK_STATUS, type TaskStatus } from "@/lib/constants";
import { taskSchema } from "./schema";

/** Team members can move work forward up to review; approvals are for managers. */
const TEAM_ALLOWED: TaskStatus[] = ["todo", "in_progress", "internal_review"];

export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff();
    const v = taskSchema.parse(formToObject(fd));
    if (!can(s.role, "tasks.manage") && !TEAM_ALLOWED.includes(v.status)) return fail("Team members can create tasks up to Internal review.");
    const supabase = await createClient();
    const t = unwrap(await supabase.from("tasks").insert({ ...v, organization_id: s.orgId, created_by: s.userId }).select("id").single());
    await logActivity(supabase, s, { entityType: "task", entityId: t.id, action: "created", summary: `Task “${v.title}” created`, projectId: v.project_id });
    revalidatePath("/tasks"); revalidatePath(`/projects/${v.project_id}`);
    return ok("Task created", { id: t.id });
  } catch (e) { return toActionError(e); }
}

export async function updateTask(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff();
    const v = taskSchema.parse(formToObject(fd));
    if (!can(s.role, "tasks.manage") && !TEAM_ALLOWED.includes(v.status)) return fail("Only managers can approve or complete tasks. Move it to Internal review instead.");
    const supabase = await createClient();
    unwrap(await supabase.from("tasks").update(v).eq("id", id).select("id").single());
    revalidatePath("/tasks"); revalidatePath(`/tasks/${id}`); revalidatePath(`/projects/${v.project_id}`);
    return ok("Task updated");
  } catch (e) { return toActionError(e); }
}

export async function setTaskStatus(id: string, status: string): Promise<ActionState> {
  try {
    const s = await authorizeStaff();
    if (!TASK_STATUS.values.includes(status as TaskStatus)) return fail("Invalid status");
    if (!can(s.role, "tasks.manage") && !TEAM_ALLOWED.includes(status as TaskStatus)) return fail("Only managers can approve or complete tasks. Submit it for Internal review.");
    const supabase = await createClient();
    const t = unwrap(await supabase.from("tasks").update({ status }).eq("id", id).select("title, project_id").single());
    await logActivity(supabase, s, { entityType: "task", entityId: id, action: "status_changed", summary: `“${t.title}” → ${TASK_STATUS.label[status as TaskStatus]}`, projectId: t.project_id });
    revalidatePath("/tasks"); revalidatePath(`/tasks/${id}`); revalidatePath(`/projects/${t.project_id}`);
    return ok(`Moved to ${TASK_STATUS.label[status as TaskStatus]}`);
  } catch (e) { return toActionError(e); }
}

export async function deleteTask(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("tasks.manage");
    const supabase = await createClient();
    const t = unwrap(await supabase.from("tasks").delete().eq("id", id).select("project_id").single());
    revalidatePath("/tasks"); revalidatePath(`/projects/${t.project_id}`);
    return ok("Task deleted");
  } catch (e) { return toActionError(e); }
}

export async function deleteTaskAndReturn(id: string): Promise<ActionState> {
  const res = await deleteTask(id);
  if (!res.ok) return res;
  redirect("/tasks");
}

export async function addTaskComment(taskId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff();
    const body = String(fd.get("body") ?? "").trim();
    if (!body) return fail("Write a comment first.", { body: "Required" });
    if (body.length > 5000) return fail("Comment is too long.");
    const supabase = await createClient();
    unwrap(await supabase.from("task_comments").insert({ organization_id: s.orgId, task_id: taskId, author_id: s.userId, body }).select("id").single());
    revalidatePath(`/tasks/${taskId}`);
    return ok("Comment added");
  } catch (e) { return toActionError(e); }
}

export async function deleteTaskComment(taskId: string, id: string): Promise<ActionState> {
  try {
    await authorizeStaff();
    const supabase = await createClient();
    unwrap(await supabase.from("task_comments").delete().eq("id", id).select("id").single());
    revalidatePath(`/tasks/${taskId}`);
    return ok("Comment deleted");
  } catch (e) { return toActionError(e); }
}
