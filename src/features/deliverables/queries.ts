import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DeliverableRow = {
  id: string; name: string; position: number; content_received: boolean; content_received_at: string | null; design_status: string; assigned_to: string | null;
  internal_review_status: string; client_review_status: string; approval_status: string; revision_count: number; submitted_at: string | null;
  final_delivered_at: string | null; approved_at: string | null; current_file_id: string | null; client_visible: boolean;
  designer: { full_name: string } | null; file: { id: string; name: string; version: number; mime_type: string | null } | null;
};

export async function listDeliverables(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deliverables")
    .select("id, name, position, content_received, content_received_at, design_status, assigned_to, internal_review_status, client_review_status, approval_status, revision_count, submitted_at, final_delivered_at, approved_at, current_file_id, client_visible, designer:profiles!deliverables_assigned_to_fkey(full_name), file:files!deliverables_current_file_fk(id, name, version, mime_type)")
    .eq("project_id", projectId)
    .order("position");
  if (error) throw error;
  return (data ?? []) as unknown as DeliverableRow[];
}

export type ApprovalRow = { id: string; decision: string; comment: string | null; decided_at: string; file_version: number | null; deliverable: { id: string; name: string } | null; decider: { full_name: string } | null };
export type RevisionRow = { id: string; revision_number: number; notes: string | null; created_at: string; resolved_at: string | null; deliverable: { id: string; name: string } | null; requester: { full_name: string } | null };

export async function approvalHistory(projectId: string) {
  const supabase = await createClient();
  const { data: ids } = await supabase.from("deliverables").select("id").eq("project_id", projectId);
  const list = (ids ?? []).map((d) => d.id as string);
  if (!list.length) return { approvals: [] as ApprovalRow[], revisions: [] as RevisionRow[] };
  const [a, r] = await Promise.all([
    supabase.from("approvals").select("id, decision, comment, decided_at, file_version, deliverable:deliverables(id, name), decider:profiles!approvals_decided_by_fkey(full_name)").in("deliverable_id", list).order("decided_at", { ascending: false }).limit(200),
    supabase.from("revisions").select("id, revision_number, notes, created_at, resolved_at, deliverable:deliverables(id, name), requester:profiles!revisions_requested_by_fkey(full_name)").in("deliverable_id", list).order("created_at", { ascending: false }).limit(200),
  ]);
  return { approvals: (a.data ?? []) as unknown as ApprovalRow[], revisions: (r.data ?? []) as unknown as RevisionRow[] };
}
