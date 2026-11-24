import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, listParams, str, type ResolvedParams } from "@/lib/list-params";

export type LeadRow = {
  id: string; code: string; company_name: string; contact_person: string | null; phone: string | null; email: string | null; location: string | null;
  services: string[]; source: string | null; estimated_budget: number | null; assigned_to: string | null; status: string; next_follow_up: string | null;
  notes: string | null; converted_client_id: string | null; created_at: string; assignee: { full_name: string } | null;
};

const SELECT = "id, code, company_name, contact_person, phone, email, location, services, source, estimated_budget, assigned_to, status, next_follow_up, notes, converted_client_id, created_at, assignee:profiles!leads_assigned_to_fkey(full_name)";
export const LEAD_SORTS = ["created_at", "company_name", "estimated_budget", "next_follow_up", "status"] as const;

export async function listLeads(sp: ResolvedParams, opts: { board?: boolean } = {}) {
  const p = listParams(sp, LEAD_SORTS, "created_at");
  const supabase = await createClient();
  let q = supabase.from("leads").select(SELECT, { count: "exact" });
  if (p.q) { const t = ilikeTerm(p.q); q = q.or(`company_name.ilike.${t},contact_person.ilike.${t},email.ilike.${t},phone.ilike.${t},code.ilike.${t},location.ilike.${t}`); }
  const status = str(sp, "status"); if (status && !opts.board) q = q.eq("status", status);
  const source = str(sp, "source"); if (source) q = q.eq("source", source);
  const assignee = str(sp, "assignee"); if (assignee) q = assignee === "none" ? q.is("assigned_to", null) : q.eq("assigned_to", assignee);
  if (str(sp, "due") === "1") q = q.lte("next_follow_up", new Date().toISOString().slice(0, 10)).not("status", "in", "(won,lost)");
  q = q.order(p.sort, { ascending: p.ascending, nullsFirst: false });
  q = opts.board ? q.limit(500) : q.range(p.from, p.to);
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as LeadRow[], total: count ?? 0, params: p };
}

export async function getLead(id: string) {
  const supabase = await createClient();
  const [{ data: lead }, { data: activities }] = await Promise.all([
    supabase.from("leads").select(SELECT).eq("id", id).maybeSingle(),
    supabase.from("lead_activities").select("id, type, content, follow_up_date, created_at, author:profiles!lead_activities_created_by_fkey(full_name)").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);
  return { lead: lead as unknown as LeadRow | null, activities: (activities ?? []) as unknown as { id: string; type: string; content: string; follow_up_date: string | null; created_at: string; author: { full_name: string } | null }[] };
}
