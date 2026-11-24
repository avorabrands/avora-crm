import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, listParams, str, type ResolvedParams } from "@/lib/list-params";
import { ACTIVE_PROJECT_STATUSES } from "@/lib/constants";

export type ProjectRow = {
  id: string; code: string; name: string; client_id: string; category: string; description: string | null; start_date: string | null; due_date: string | null;
  budget: number | null; manager_id: string | null; priority: string; status: string; progress: number; progress_mode: string; client_visible: boolean;
  created_at: string; completed_at: string | null; client: { company_name: string } | null; manager: { full_name: string } | null;
};
const SELECT = "id, code, name, client_id, category, description, start_date, due_date, budget, manager_id, priority, status, progress, progress_mode, client_visible, created_at, completed_at, client:clients(company_name), manager:profiles!projects_manager_id_fkey(full_name)";
export const PROJECT_SORTS = ["created_at", "name", "due_date", "progress", "status", "priority"] as const;

export async function listProjects(sp: ResolvedParams, fixed: { clientId?: string } = {}) {
  const p = listParams(sp, PROJECT_SORTS, "created_at");
  const supabase = await createClient();
  let q = supabase.from("projects").select(SELECT, { count: "exact" });
  if (fixed.clientId) q = q.eq("client_id", fixed.clientId);
  if (p.q) { const t = ilikeTerm(p.q); q = q.or(`name.ilike.${t},code.ilike.${t}`); }
  const status = str(sp, "status");
  if (status === "active") q = q.in("status", ACTIVE_PROJECT_STATUSES); else if (status) q = q.eq("status", status);
  const category = str(sp, "category"); if (category) q = q.eq("category", category);
  const manager = str(sp, "manager"); if (manager) q = q.eq("manager_id", manager);
  const client = str(sp, "client"); if (client) q = q.eq("client_id", client);
  if (str(sp, "overdue") === "1") q = q.lt("due_date", new Date().toISOString().slice(0, 10)).in("status", ACTIVE_PROJECT_STATUSES);
  const { data, count, error } = await q.order(p.sort, { ascending: p.ascending, nullsFirst: false }).range(p.from, p.to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as ProjectRow[], total: count ?? 0, params: p };
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const [{ data: project }, { data: members }] = await Promise.all([
    supabase.from("projects").select(SELECT).eq("id", id).maybeSingle(),
    supabase.from("project_members").select("user_id, role_label, profile:profiles(full_name, email)").eq("project_id", id),
  ]);
  return {
    project: project as unknown as ProjectRow | null,
    members: (members ?? []) as unknown as { user_id: string; role_label: string | null; profile: { full_name: string; email: string } | null }[],
  };
}

export async function projectCounts(projectId: string) {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [tasks, deliverables, files, milestones, pendingApprovals] = await Promise.all([
    supabase.from("tasks").select("id", head).eq("project_id", projectId),
    supabase.from("deliverables").select("id", head).eq("project_id", projectId),
    supabase.from("files").select("id", head).eq("project_id", projectId).eq("is_latest", true),
    supabase.from("project_milestones").select("id", head).eq("project_id", projectId),
    supabase.from("deliverables").select("id", head).eq("project_id", projectId).eq("client_review_status", "pending"),
  ]);
  return { tasks: tasks.count ?? 0, deliverables: deliverables.count ?? 0, files: files.count ?? 0, milestones: milestones.count ?? 0, pendingApprovals: pendingApprovals.count ?? 0 };
}
