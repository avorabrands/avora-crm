import "server-only";
import { eachMonthOfInterval, format, parseISO, subMonths, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_PROJECT_STATUSES, LEAD_STATUS, OPEN_TASK_STATUSES, OPPORTUNITY_STAGE, PROJECT_STATUS } from "@/lib/constants";
import { todayISO } from "@/lib/format";

export type ReportFilters = { from: string; to: string; client?: string; project?: string; employee?: string };
export type Report = { key: string; title: string; description: string; columns: { key: string; label: string; money?: boolean; align?: "right" }[]; rows: Record<string, string | number>[]; adminOnly?: boolean };

export const REPORT_KEYS = ["monthly_revenue", "client_revenue", "outstanding", "profitability", "lead_conversion", "pipeline", "project_completion", "team_productivity", "delayed_projects"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export function parseFilters(sp: Record<string, string | string[] | undefined>): ReportFilters {
  const g = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = g("from") && iso.test(g("from")!) ? g("from")! : format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
  const to = g("to") && iso.test(g("to")!) ? g("to")! : todayISO();
  return { from, to, client: g("client"), project: g("project"), employee: g("employee") };
}

export async function buildReport(key: ReportKey, f: ReportFilters, opts: { admin: boolean }): Promise<Report | null> {
  const supabase = await createClient();
  const money = (n: number) => Math.round(n * 100) / 100;

  switch (key) {
    case "monthly_revenue": {
      let q = supabase.from("payments").select("amount, payment_date").gte("payment_date", f.from).lte("payment_date", f.to);
      let iq = supabase.from("invoices").select("total, invoice_date").not("status", "in", "(draft,cancelled)").gte("invoice_date", f.from).lte("invoice_date", f.to);
      if (f.client) { q = q.eq("client_id", f.client); iq = iq.eq("client_id", f.client); }
      if (f.project) { q = q.eq("project_id", f.project); iq = iq.eq("project_id", f.project); }
      const [{ data: pays }, { data: invs }] = await Promise.all([q, iq]);
      const months = eachMonthOfInterval({ start: parseISO(f.from), end: parseISO(f.to) }).map((d) => format(d, "yyyy-MM"));
      return { key, title: "Monthly revenue", description: "Invoiced vs received per month (cash basis for received).", columns: [{ key: "month", label: "Month" }, { key: "invoiced", label: "Invoiced", money: true, align: "right" }, { key: "received", label: "Received", money: true, align: "right" }],
        rows: months.map((m) => ({ month: format(parseISO(`${m}-01`), "MMM yyyy"), invoiced: money((invs ?? []).filter((i) => i.invoice_date.startsWith(m)).reduce((a, i) => a + Number(i.total), 0)), received: money((pays ?? []).filter((p) => p.payment_date.startsWith(m)).reduce((a, p) => a + Number(p.amount), 0)) })) };
    }
    case "client_revenue":
    case "outstanding": {
      let iq = supabase.from("invoices").select("client_id, total, amount_paid, due_date, status, client:clients(company_name)").not("status", "in", "(draft,cancelled)");
      if (key === "client_revenue") iq = iq.gte("invoice_date", f.from).lte("invoice_date", f.to);
      if (f.client) iq = iq.eq("client_id", f.client);
      if (f.project) iq = iq.eq("project_id", f.project);
      const { data } = await iq;
      const by = new Map<string, { client: string; invoices: number; invoiced: number; received: number; outstanding: number; overdue: number }>();
      for (const i of data ?? []) {
        const r = by.get(i.client_id) ?? { client: (i.client as unknown as { company_name: string })?.company_name ?? "—", invoices: 0, invoiced: 0, received: 0, outstanding: 0, overdue: 0 };
        const bal = Number(i.total) - Number(i.amount_paid);
        r.invoices++; r.invoiced += Number(i.total); r.received += Number(i.amount_paid); r.outstanding += bal; if (bal > 0 && i.due_date < todayISO()) r.overdue += bal;
        by.set(i.client_id, r);
      }
      const rows = [...by.values()].map((r) => ({ ...r, invoiced: money(r.invoiced), received: money(r.received), outstanding: money(r.outstanding), overdue: money(r.overdue) }));
      if (key === "client_revenue") return { key, title: "Client-wise revenue", description: "Invoices issued in the period, by client.", columns: [{ key: "client", label: "Client" }, { key: "invoices", label: "Invoices", align: "right" }, { key: "invoiced", label: "Invoiced", money: true, align: "right" }, { key: "received", label: "Received", money: true, align: "right" }], rows: rows.sort((a, b) => b.invoiced - a.invoiced) };
      return { key, title: "Outstanding payments", description: "All open balances today (not limited by date range).", columns: [{ key: "client", label: "Client" }, { key: "outstanding", label: "Outstanding", money: true, align: "right" }, { key: "overdue", label: "Overdue", money: true, align: "right" }], rows: rows.filter((r) => r.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding) };
    }
    case "profitability": {
      if (!opts.admin) return null;
      let pq = supabase.from("projects").select("id, code, name, budget, status, client:clients(company_name), fin:project_financials(estimated_cost, actual_cost)");
      if (f.client) pq = pq.eq("client_id", f.client);
      if (f.project) pq = pq.eq("id", f.project);
      const [{ data: projects }, { data: pays }] = await Promise.all([pq, supabase.from("payments").select("project_id, amount")]);
      return { key, title: "Project profitability", description: "Admin only. Margin = (budget − cost) ÷ budget; cost uses actual if set, else estimate.", adminOnly: true,
        columns: [{ key: "project", label: "Project" }, { key: "client", label: "Client" }, { key: "budget", label: "Budget", money: true, align: "right" }, { key: "received", label: "Received", money: true, align: "right" }, { key: "cost", label: "Cost", money: true, align: "right" }, { key: "profit", label: "Profit", money: true, align: "right" }, { key: "margin", label: "Margin %", align: "right" }],
        rows: (projects ?? []).map((p) => {
          const fin = (Array.isArray(p.fin) ? p.fin[0] : p.fin) as { estimated_cost: number; actual_cost: number } | null;
          const cost = Number(fin?.actual_cost || fin?.estimated_cost || 0);
          const budget = Number(p.budget ?? 0);
          return { project: `${p.code} · ${p.name}`, client: (p.client as unknown as { company_name: string })?.company_name ?? "—", budget, received: money((pays ?? []).filter((x) => x.project_id === p.id).reduce((a, x) => a + Number(x.amount), 0)), cost, profit: money(budget - cost), margin: budget ? Math.round(((budget - cost) / budget) * 100) : 0 };
        }) };
    }
    case "lead_conversion": {
      let q = supabase.from("leads").select("source, status").gte("created_at", f.from).lte("created_at", `${f.to}T23:59:59`);
      if (f.employee) q = q.eq("assigned_to", f.employee);
      const { data } = await q;
      const by = new Map<string, { source: string; leads: number; won: number; lost: number }>();
      for (const l of data ?? []) { const k = l.source ?? "Unknown"; const r = by.get(k) ?? { source: k, leads: 0, won: 0, lost: 0 }; r.leads++; if (l.status === "won") r.won++; if (l.status === "lost") r.lost++; by.set(k, r); }
      return { key, title: "Lead conversion", description: "Leads created in the period, by source.", columns: [{ key: "source", label: "Source" }, { key: "leads", label: "Leads", align: "right" }, { key: "won", label: "Won", align: "right" }, { key: "lost", label: "Lost", align: "right" }, { key: "rate", label: "Conversion %", align: "right" }],
        rows: [...by.values()].map((r) => ({ ...r, rate: r.leads ? Math.round((r.won / r.leads) * 100) : 0 })).sort((a, b) => b.leads - a.leads) };
    }
    case "pipeline": {
      let q = supabase.from("opportunities").select("stage, value");
      if (f.employee) q = q.eq("assigned_to", f.employee);
      if (f.client) q = q.eq("client_id", f.client);
      const [{ data: opps }, { data: leads }] = await Promise.all([q, supabase.from("leads").select("status, estimated_budget")]);
      return { key, title: "Sales pipeline", description: "Current deals and leads by stage.", columns: [{ key: "stage", label: "Stage" }, { key: "deals", label: "Deals", align: "right" }, { key: "value", label: "Deal value", money: true, align: "right" }, { key: "leads", label: "Leads (same stage)", align: "right" }],
        rows: OPPORTUNITY_STAGE.values.map((st) => ({ stage: OPPORTUNITY_STAGE.label[st], deals: (opps ?? []).filter((o) => o.stage === st).length, value: money((opps ?? []).filter((o) => o.stage === st).reduce((a, o) => a + Number(o.value), 0)), leads: (leads ?? []).filter((l) => l.status === st).length }))
          .concat(LEAD_STATUS.values.filter((s) => !(OPPORTUNITY_STAGE.values as readonly string[]).includes(s)).map((s) => ({ stage: `${LEAD_STATUS.label[s]} (lead only)`, deals: 0, value: 0, leads: (leads ?? []).filter((l) => l.status === s).length }))) };
    }
    case "project_completion": {
      let q = supabase.from("projects").select("status, created_at").gte("created_at", f.from).lte("created_at", `${f.to}T23:59:59`);
      if (f.client) q = q.eq("client_id", f.client);
      if (f.employee) q = q.eq("manager_id", f.employee);
      const { data } = await q;
      const total = (data ?? []).length;
      return { key, title: "Project completion", description: "Projects started in the period, by current status.", columns: [{ key: "status", label: "Status" }, { key: "projects", label: "Projects", align: "right" }, { key: "share", label: "Share %", align: "right" }],
        rows: PROJECT_STATUS.values.map((s) => { const n = (data ?? []).filter((p) => p.status === s).length; return { status: PROJECT_STATUS.label[s], projects: n, share: total ? Math.round((n / total) * 100) : 0 }; }).filter((r) => r.projects > 0) };
    }
    case "team_productivity": {
      let tq = supabase.from("tasks").select("assigned_to, status, due_date, completed_at, assignee:profiles!tasks_assigned_to_fkey(full_name)").not("assigned_to", "is", null);
      if (f.project) tq = tq.eq("project_id", f.project);
      if (f.employee) tq = tq.eq("assigned_to", f.employee);
      const [{ data: tasks }, { data: dels }] = await Promise.all([tq, supabase.from("deliverables").select("assigned_to, approval_status, revision_count").not("assigned_to", "is", null)]);
      const by = new Map<string, { employee: string; open: number; completed: number; on_time: number; overdue: number; deliverables_approved: number; revisions: number }>();
      const get = (id: string, name?: string) => { const r = by.get(id) ?? { employee: name ?? "—", open: 0, completed: 0, on_time: 0, overdue: 0, deliverables_approved: 0, revisions: 0 }; if (name) r.employee = name; by.set(id, r); return r; };
      for (const t of tasks ?? []) {
        const r = get(t.assigned_to!, (t.assignee as unknown as { full_name: string })?.full_name);
        if (t.completed_at && t.completed_at >= f.from && t.completed_at <= `${f.to}T23:59:59`) { r.completed++; if (!t.due_date || t.completed_at.slice(0, 10) <= t.due_date) r.on_time++; }
        if ((OPEN_TASK_STATUSES as string[]).includes(t.status)) { r.open++; if (t.due_date && t.due_date < todayISO()) r.overdue++; }
      }
      for (const d of dels ?? []) { const r = by.get(d.assigned_to!); if (!r) continue; if (d.approval_status === "approved") r.deliverables_approved++; r.revisions += d.revision_count; }
      return { key, title: "Team productivity", description: "Tasks completed in the period (on-time = by due date), open workload today, deliverable outcomes.", columns: [{ key: "employee", label: "Employee" }, { key: "completed", label: "Completed", align: "right" }, { key: "on_time", label: "On time", align: "right" }, { key: "open", label: "Open", align: "right" }, { key: "overdue", label: "Overdue", align: "right" }, { key: "deliverables_approved", label: "Deliverables approved", align: "right" }, { key: "revisions", label: "Revisions", align: "right" }],
        rows: [...by.values()].sort((a, b) => b.completed - a.completed) };
    }
    case "delayed_projects": {
      let q = supabase.from("projects").select("code, name, due_date, status, progress, client:clients(company_name), manager:profiles!projects_manager_id_fkey(full_name)").in("status", ACTIVE_PROJECT_STATUSES).lt("due_date", todayISO()).order("due_date");
      if (f.client) q = q.eq("client_id", f.client);
      if (f.employee) q = q.eq("manager_id", f.employee);
      const { data } = await q;
      return { key, title: "Delayed projects", description: "Active projects past their expected delivery date.", columns: [{ key: "project", label: "Project" }, { key: "client", label: "Client" }, { key: "manager", label: "Manager" }, { key: "due", label: "Due" }, { key: "days", label: "Days late", align: "right" }, { key: "progress", label: "Progress %", align: "right" }],
        rows: (data ?? []).map((p) => ({ project: `${p.code} · ${p.name}`, client: (p.client as unknown as { company_name: string })?.company_name ?? "—", manager: (p.manager as unknown as { full_name: string })?.full_name ?? "—", due: p.due_date!, days: Math.round((Date.now() - parseISO(p.due_date!).getTime()) / 864e5), progress: p.progress })) };
    }
  }
}

export function toCSV(r: Report) {
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
  return [r.columns.map((c) => esc(c.label)).join(","), ...r.rows.map((row) => r.columns.map((c) => esc(row[c.key])).join(","))].join("\n");
}
