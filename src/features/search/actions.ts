"use server";

import { authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm } from "@/lib/list-params";
import { can } from "@/lib/auth/permissions";

export type SearchHit = { type: string; id: string; title: string; subtitle?: string; href: string };

/** Global search across modules. RLS limits every query to what the caller may see. */
export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const s = await authorizeStaff();
  const supabase = await createClient();
  const term = ilikeTerm(q);
  const finance = can(s.role, "finance.view");

  const [leads, clients, projects, tasks, invoices, quotations] = await Promise.all([
    supabase.from("leads").select("id, code, company_name, contact_person").or(`company_name.ilike.${term},contact_person.ilike.${term},code.ilike.${term},email.ilike.${term}`).limit(5),
    supabase.from("clients").select("id, code, company_name, contact_person").or(`company_name.ilike.${term},contact_person.ilike.${term},code.ilike.${term},email.ilike.${term}`).limit(5),
    supabase.from("projects").select("id, code, name, clients(company_name)").or(`name.ilike.${term},code.ilike.${term}`).limit(5),
    supabase.from("tasks").select("id, title, projects(name)").ilike("title", term).limit(5),
    finance ? supabase.from("invoices").select("id, number, clients(company_name)").ilike("number", term).limit(5) : Promise.resolve({ data: [] }),
    finance ? supabase.from("quotations").select("id, number, title").or(`number.ilike.${term},title.ilike.${term}`).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const rel = (v: unknown, k: string) => (v && typeof v === "object" ? (v as Record<string, string>)[k] : undefined);
  return [
    ...(leads.data ?? []).map((r) => ({ type: "Leads", id: r.id, title: r.company_name, subtitle: [r.code, r.contact_person].filter(Boolean).join(" · "), href: `/leads/${r.id}` })),
    ...(clients.data ?? []).map((r) => ({ type: "Clients", id: r.id, title: r.company_name, subtitle: [r.code, r.contact_person].filter(Boolean).join(" · "), href: `/clients/${r.id}` })),
    ...(projects.data ?? []).map((r) => ({ type: "Projects", id: r.id, title: r.name, subtitle: [r.code, rel(r.clients, "company_name")].filter(Boolean).join(" · "), href: `/projects/${r.id}` })),
    ...(tasks.data ?? []).map((r) => ({ type: "Tasks", id: r.id, title: r.title, subtitle: rel(r.projects, "name"), href: `/tasks/${r.id}` })),
    ...((invoices.data ?? []) as { id: string; number: string; clients: unknown }[]).map((r) => ({ type: "Invoices", id: r.id, title: r.number, subtitle: rel(r.clients, "company_name"), href: `/invoices/${r.id}` })),
    ...((quotations.data ?? []) as { id: string; number: string; title: string }[]).map((r) => ({ type: "Quotations", id: r.id, title: r.number, subtitle: r.title, href: `/quotations/${r.id}` })),
  ];
}
