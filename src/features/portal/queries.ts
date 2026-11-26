import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function portalMe() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_me").maybeSingle();
  return data as { organization_id: string; client_id: string; company_name: string; contact_person: string | null; email: string | null; phone: string | null; billing_address: string | null; gstin: string | null; code: string } | null;
}

export type PortalDeliverable = {
  id: string; name: string; project_id: string; client_review_status: string; approval_status: string; revision_count: number; submitted_at: string | null; approved_at: string | null; final_delivered_at: string | null;
  project: { name: string } | null; file: { id: string; name: string; version: number; mime_type: string | null } | null;
};

export async function portalDeliverables(filter: { projectId?: string; pendingOnly?: boolean } = {}) {
  const supabase = await createClient();
  let q = supabase.from("deliverables").select("id, name, project_id, client_review_status, approval_status, revision_count, submitted_at, approved_at, final_delivered_at, project:projects(name), file:files!deliverables_current_file_fk(id, name, version, mime_type)").order("submitted_at", { ascending: false, nullsFirst: false }).order("position");
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  if (filter.pendingOnly) q = q.eq("client_review_status", "pending");
  const { data } = await q;
  return (data ?? []) as unknown as PortalDeliverable[];
}

/** The lead a lead-portal user represents (quotations-only portal). */
export async function leadPortalMe() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("lead_portal_me").maybeSingle();
  return data as { organization_id: string; lead_id: string; company_name: string; contact_person: string | null; email: string | null; phone: string | null; location: string | null; code: string } | null;
}
