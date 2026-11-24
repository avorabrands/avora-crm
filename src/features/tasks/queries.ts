import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, listParams, str, type ResolvedParams } from "@/lib/list-params";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { todayISO } from "@/lib/format";

export type TaskRow = {
  id: string; title: string; description: string | null; project_id: string; deliverable_id: string | null; assigned_to: string | null; priority: string;
  start_date: string | null; due_date: string | null; status: string; completed_at: string | null; created_at: string;
  assignee: { full_name: string } | null; project: { name: string; code: string } | null; deliverable: { name: string } | null;
};
const SELECT = "id, title, description, project_id, deliverable_id, assigned_to, priority, start_date, due_date, status, completed_at, created_at, assignee:profiles!tasks_assigned_to_fkey(full_name), project:projects(name, code), deliverable:deliverables(name)";

export async function listTasks(sp: ResolvedParams, fixed: { projectId?: string } = {}, opts: { all?: boolean; userId?: string } = {}) {
  const p = listParams(sp, ["due_date", "created_at", "priority", "status", "title"] as const, "due_date", "asc", 30);
  const supabase = await createClient();
  let q = supabase.from("tasks").select(SELECT, { count: "exact" });
  if (fixed.projectId) q = q.eq("project_id", fixed.projectId);
  if (p.q) q = q.ilike("title", ilikeTerm(p.q));
  const status = str(sp, "status");
  if (status === "open") q = q.in("status", OPEN_TASK_STATUSES); else if (status) q = q.eq("status", status);
  const priority = str(sp, "priority"); if (priority) q = q.eq("priority", priority);
  const project = str(sp, "project"); if (project) q = q.eq("project_id", project);
  const assignee = str(sp, "assignee");
  if (assignee === "me" && opts.userId) q = q.eq("assigned_to", opts.userId);
  else if (assignee === "none") q = q.is("assigned_to", null);
  else if (assignee) q = q.eq("assigned_to", assignee);
  if (str(sp, "overdue") === "1") q = q.lt("due_date", todayISO()).in("status", OPEN_TASK_STATUSES);
  const month = str(sp, "month"); // calendar view: yyyy-mm
  if (month && /^\d{4}-\d{2}$/.test(month)) { const [y, m] = month.split("-").map(Number); const end = new Date(y!, m!, 0).getDate(); q = q.gte("due_date", `${month}-01`).lte("due_date", `${month}-${String(end).padStart(2, "0")}`); }
  q = q.order(p.sort, { ascending: p.ascending, nullsFirst: false }).order("created_at", { ascending: false });
  q = opts.all ? q.limit(500) : q.range(p.from, p.to);
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as TaskRow[], total: count ?? 0, params: p };
}

export async function getTask(id: string) {
  const supabase = await createClient();
  const [{ data: task }, { data: comments }] = await Promise.all([
    supabase.from("tasks").select(SELECT).eq("id", id).maybeSingle(),
    supabase.from("task_comments").select("id, body, created_at, author_id, author:profiles!task_comments_author_id_fkey(full_name)").eq("task_id", id).order("created_at"),
  ]);
  return { task: task as unknown as TaskRow | null, comments: (comments ?? []) as unknown as { id: string; body: string; created_at: string; author_id: string; author: { full_name: string } | null }[] };
}
