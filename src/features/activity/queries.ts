import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ActivityRow = { id: string; entity_type: string; action: string; summary: string; created_at: string; client_visible: boolean; actor: { full_name: string } | null };

export async function listActivity(filter: { clientId?: string; projectId?: string; limit?: number; clientVisibleOnly?: boolean }) {
  const supabase = await createClient();
  let q = supabase.from("activity_logs").select("id, entity_type, action, summary, created_at, client_visible, actor:profiles!activity_logs_actor_id_fkey(full_name)").order("created_at", { ascending: false }).limit(filter.limit ?? 50);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  if (filter.clientVisibleOnly) q = q.eq("client_visible", true);
  const { data } = await q;
  return (data ?? []) as unknown as ActivityRow[];
}
