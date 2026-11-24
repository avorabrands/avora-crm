import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, listParams, str, type ResolvedParams } from "@/lib/list-params";

export type ClientRow = {
  id: string; code: string; company_name: string; contact_person: string | null; phone: string | null; email: string | null; billing_address: string | null;
  state: string | null; gstin: string | null; pan: string | null; website: string | null; category: string | null; status: string; account_manager_id: string | null;
  notes: string | null; lead_id: string | null; created_at: string; manager: { full_name: string } | null;
};
const SELECT = "id, code, company_name, contact_person, phone, email, billing_address, state, gstin, pan, website, category, status, account_manager_id, notes, lead_id, created_at, manager:profiles!clients_account_manager_id_fkey(full_name)";
export const CLIENT_SORTS = ["created_at", "company_name", "code", "status"] as const;

export async function listClients(sp: ResolvedParams) {
  const p = listParams(sp, CLIENT_SORTS, "company_name", "asc");
  const supabase = await createClient();
  let q = supabase.from("clients").select(SELECT, { count: "exact" });
  if (p.q) { const t = ilikeTerm(p.q); q = q.or(`company_name.ilike.${t},contact_person.ilike.${t},email.ilike.${t},code.ilike.${t},gstin.ilike.${t}`); }
  const status = str(sp, "status"); if (status) q = q.eq("status", status);
  const category = str(sp, "category"); if (category) q = q.eq("category", category);
  const manager = str(sp, "manager"); if (manager) q = q.eq("account_manager_id", manager);
  const { data, count, error } = await q.order(p.sort, { ascending: p.ascending }).range(p.from, p.to);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ClientRow[];
  return { rows, total: count ?? 0, params: p };
}

/** Revenue + outstanding per client (finance roles only; RLS returns nothing otherwise). */
export async function clientFinancials(clientIds: string[]) {
  if (!clientIds.length) return {} as Record<string, { invoiced: number; received: number; outstanding: number }>;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("client_id, total, amount_paid, status").in("client_id", clientIds).not("status", "in", "(draft,cancelled)");
  const out: Record<string, { invoiced: number; received: number; outstanding: number }> = {};
  for (const i of data ?? []) {
    const r = (out[i.client_id] ??= { invoiced: 0, received: 0, outstanding: 0 });
    r.invoiced += Number(i.total); r.received += Number(i.amount_paid); r.outstanding += Number(i.total) - Number(i.amount_paid);
  }
  return out;
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select(SELECT).eq("id", id).maybeSingle();
  return data as unknown as ClientRow | null;
}
