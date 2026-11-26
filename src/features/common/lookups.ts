import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DocTemplate } from "@/lib/doc-templates";

export type Option = { value: string; label: string; sub?: string };

/** Active staff for assignment dropdowns. */
export async function staffOptions(orgId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, role, designation, profiles(full_name, email)")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .in("role", ["admin", "manager", "team_member"]);
  return (data ?? [])
    .map((m) => {
      const p = m.profiles as unknown as { full_name: string; email: string } | null;
      return { value: m.user_id as string, label: p?.full_name || p?.email || "Unknown", sub: (m.designation as string) ?? undefined };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function clientOptions(): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, company_name, code").neq("status", "inactive").order("company_name");
  return (data ?? []).map((c) => ({ value: c.id, label: c.company_name, sub: c.code }));
}

export async function projectOptions(clientId?: string): Promise<(Option & { clientId: string })[]> {
  const supabase = await createClient();
  let q = supabase.from("projects").select("id, name, code, client_id").not("status", "in", "(cancelled)").order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return (data ?? []).map((p) => ({ value: p.id, label: p.name, sub: p.code, clientId: p.client_id }));
}

export async function companySettings(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("company_settings").select("*").eq("organization_id", orgId).maybeSingle();
  return data as CompanySettings | null;
}

export type CompanySettings = {
  organization_id: string; company_name: string; legal_name: string | null; tagline: string | null; address: string | null; state: string | null;
  gstin: string | null; pan: string | null; email: string | null; phone: string | null; website: string | null; logo_path: string | null;
  currency: string; tax_rates: { label: string; rate: number }[]; default_tax_rate: number; quotation_prefix: string; invoice_prefix: string;
  receipt_prefix: string; quotation_template: DocTemplate; invoice_template: DocTemplate; default_payment_terms: string | null; default_terms: string | null; bank_details: string | null;
};

/** Supabase embeds come back as object | object[] | null depending on FK direction. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function deliverableOptions(projectId?: string) {
  const supabase = await createClient();
  let q = supabase.from("deliverables").select("id, name, project_id").order("position").limit(2000);
  if (projectId) q = q.eq("project_id", projectId);
  const { data } = await q;
  return (data ?? []).map((d) => ({ value: d.id as string, label: d.name as string, projectId: d.project_id as string }));
}
