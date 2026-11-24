import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/lib/auth/session";

/** Append to the audit trail via the log_activity RPC (never fails the caller). */
export async function logActivity(
  supabase: SupabaseClient,
  session: Session,
  entry: { entityType: string; entityId?: string | null; action: string; summary: string; metadata?: Record<string, unknown>; clientId?: string | null; projectId?: string | null; clientVisible?: boolean },
) {
  const { error } = await supabase.rpc("log_activity", {
    p_org: session.orgId,
    p_entity_type: entry.entityType,
    p_entity_id: entry.entityId ?? null,
    p_action: entry.action,
    p_summary: entry.summary,
    p_metadata: entry.metadata ?? {},
    p_client: entry.clientId ?? null,
    p_project: entry.projectId ?? null,
    p_client_visible: entry.clientVisible ?? false,
  });
  if (error) console.error("log_activity failed", error.message);
}
