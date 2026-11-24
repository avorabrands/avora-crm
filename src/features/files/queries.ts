import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, listParams, str, type ResolvedParams } from "@/lib/list-params";

export type FileRow = {
  id: string; name: string; folder: string; mime_type: string | null; size_bytes: number; category: string; version: number; root_file_id: string | null;
  is_latest: boolean; client_visible: boolean; created_at: string; client_id: string | null; project_id: string | null; deliverable_id: string | null;
  uploader: { full_name: string } | null; project: { name: string; code: string } | null; client: { company_name: string } | null;
};
const SELECT = "id, name, folder, mime_type, size_bytes, category, version, root_file_id, is_latest, client_visible, created_at, client_id, project_id, deliverable_id, uploader:profiles!files_uploaded_by_fkey(full_name), project:projects(name, code), client:clients(company_name)";

export async function listFiles(sp: ResolvedParams, fixed: { projectId?: string; clientId?: string; taskId?: string; latestOnly?: boolean } = {}) {
  const p = listParams(sp, ["created_at", "name", "size_bytes"] as const, "created_at", "desc", 50);
  const supabase = await createClient();
  let q = supabase.from("files").select(SELECT, { count: "exact" });
  if (fixed.latestOnly !== false) q = q.eq("is_latest", true);
  if (fixed.projectId) q = q.eq("project_id", fixed.projectId);
  if (fixed.clientId) q = q.eq("client_id", fixed.clientId);
  if (fixed.taskId) q = q.eq("task_id", fixed.taskId);
  if (p.q) q = q.ilike("name", ilikeTerm(p.q));
  const cat = str(sp, "category"); if (cat) q = q.eq("category", cat);
  const folder = str(sp, "folder"); if (folder) q = q.eq("folder", folder);
  const project = str(sp, "project"); if (project) q = q.eq("project_id", project);
  const shared = str(sp, "shared"); if (shared) q = q.eq("client_visible", shared === "1");
  const { data, count, error } = await q.order(p.sort, { ascending: p.ascending }).range(p.from, p.to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as FileRow[], total: count ?? 0, params: p };
}

export async function fileVersions(rootId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("files").select(SELECT).or(`id.eq.${rootId},root_file_id.eq.${rootId}`).order("version", { ascending: false });
  return (data ?? []) as unknown as FileRow[];
}
