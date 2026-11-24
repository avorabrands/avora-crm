import "server-only";
import { createClient } from "@/lib/supabase/server";
import { companySettings, projectOptions } from "@/features/common/lookups";

/** Everything the quotation/invoice editors need, loaded in parallel. */
export async function editorData(orgId: string) {
  const supabase = await createClient();
  const [settings, { data: clientRows }, projects, { data: leadRows }, { data: ms }] = await Promise.all([
    companySettings(orgId),
    supabase.from("clients").select("id, company_name, code, state").neq("status", "inactive").order("company_name"),
    projectOptions(),
    supabase.from("leads").select("id, company_name, code").is("converted_client_id", null).not("status", "in", "(lost)").order("created_at", { ascending: false }).limit(200),
    supabase.from("project_milestones").select("id, title, amount, project_id").order("position"),
  ]);
  return {
    settings,
    clients: (clientRows ?? []).map((c) => ({ value: c.id as string, label: c.company_name as string, sub: c.code as string, state: c.state as string | null })),
    projects,
    leads: (leadRows ?? []).map((l) => ({ value: l.id as string, label: `${l.company_name} (${l.code})` })),
    milestones: (ms ?? []).map((m) => ({ value: m.id as string, label: m.title as string, sub: m.amount ? `₹${Number(m.amount).toLocaleString("en-IN")}` : undefined, projectId: m.project_id as string })),
    taxRates: (settings?.tax_rates ?? [{ label: "GST 18%", rate: 18 }]) as { label: string; rate: number }[],
    defaultRate: Number(settings?.default_tax_rate ?? 18),
    companyState: settings?.state ?? null,
  };
}
