import "server-only";
import { format, startOfMonth, subMonths, addDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_PROJECT_STATUSES, OPEN_TASK_STATUSES } from "@/lib/constants";
import { todayISO } from "@/lib/format";

/** Every dashboard figure is computed from live rows; RLS scopes it to the viewer. */
export async function dashboardData(opts: { finance: boolean; sales: boolean; userId: string; mine: boolean }) {
  const supabase = await createClient();
  const today = todayISO();
  const soon = format(addDays(new Date(), 14), "yyyy-MM-dd");
  const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
  const head = { count: "exact" as const, head: true };
  const none = Promise.resolve({ data: [] as never[], count: 0 });

  let taskQ = supabase.from("tasks").select("id, title, due_date, status, priority, project:projects(name)").in("status", OPEN_TASK_STATUSES).not("due_date", "is", null).lte("due_date", soon).order("due_date").limit(8);
  if (opts.mine) taskQ = taskQ.eq("assigned_to", opts.userId);
  let overdueQ = supabase.from("tasks").select("id", head).in("status", OPEN_TASK_STATUSES).lt("due_date", today);
  if (opts.mine) overdueQ = overdueQ.eq("assigned_to", opts.userId);

  const [leads, clients, projects, upcomingTasks, overdueTasks, pendingApprovals, upcomingProjects, recentLeads, activity, invoices, payments, quotations, followUps] = await Promise.all([
    opts.sales ? supabase.from("leads").select("status, estimated_budget") : none,
    supabase.from("clients").select("id", head),
    supabase.from("projects").select("status, due_date"),
    taskQ,
    overdueQ,
    supabase.from("deliverables").select("id", head).eq("client_review_status", "pending"),
    supabase.from("projects").select("id, name, due_date, status, progress, client:clients(company_name)").in("status", ACTIVE_PROJECT_STATUSES).not("due_date", "is", null).lte("due_date", soon).order("due_date").limit(6),
    opts.sales ? supabase.from("leads").select("id, company_name, contact_person, source, status, created_at").order("created_at", { ascending: false }).limit(5) : none,
    supabase.from("activity_logs").select("id, summary, created_at, actor:profiles!activity_logs_actor_id_fkey(full_name)").order("created_at", { ascending: false }).limit(8),
    opts.finance ? supabase.from("invoices").select("id, number, total, amount_paid, balance_due, due_date, status, client:clients(company_name)").in("status", ["unpaid", "partially_paid", "paid"]) : none,
    opts.finance ? supabase.from("payments").select("amount, payment_date").gte("payment_date", since) : none,
    opts.finance ? supabase.from("quotations").select("total").in("status", ["sent", "viewed"]) : none,
    // RLS limits team members to the leads assigned to them
    supabase.from("leads").select("id, company_name, contact_person, phone, email, next_follow_up").lte("next_follow_up", today).not("status", "in", "(won,lost)").order("next_follow_up").limit(6),
  ]);

  const leadRows = (leads.data ?? []) as { status: string; estimated_budget: number | null }[];
  const projectRows = (projects.data ?? []) as { status: string; due_date: string | null }[];
  const invRows = (invoices.data ?? []) as unknown as { id: string; number: string; total: number; amount_paid: number; balance_due: number; due_date: string; status: string; client: { company_name: string } | null }[];
  const payRows = (payments.data ?? []) as { amount: number; payment_date: string }[];
  const { data: allPayments } = opts.finance ? await supabase.from("payments").select("amount") : { data: [] };

  const months = Array.from({ length: 12 }, (_, i) => format(subMonths(new Date(), 11 - i), "yyyy-MM"));
  const monthly = months.map((m) => ({ month: format(new Date(`${m}-01T00:00:00`), "MMM"), amount: payRows.filter((p) => p.payment_date.startsWith(m)).reduce((a, p) => a + Number(p.amount), 0) }));
  const open = invRows.filter((i) => i.status !== "paid");

  return {
    totals: {
      leads: leadRows.length,
      openLeads: leadRows.filter((l) => !["won", "lost"].includes(l.status)).length,
      clients: clients.count ?? 0,
      activeProjects: projectRows.filter((p) => (ACTIVE_PROJECT_STATUSES as string[]).includes(p.status)).length,
      completedProjects: projectRows.filter((p) => p.status === "completed").length,
      onHoldProjects: projectRows.filter((p) => p.status === "on_hold").length,
      overdueProjects: projectRows.filter((p) => (ACTIVE_PROJECT_STATUSES as string[]).includes(p.status) && p.due_date && p.due_date < today).length,
      revenue: (allPayments ?? []).reduce((a, p) => a + Number(p.amount), 0),
      outstanding: open.reduce((a, i) => a + Number(i.balance_due), 0),
      overdueAmount: open.filter((i) => i.due_date < today).reduce((a, i) => a + Number(i.balance_due), 0),
      pendingQuotations: (quotations.data ?? []).length,
      pendingQuotationValue: ((quotations.data ?? []) as { total: number }[]).reduce((a, q) => a + Number(q.total), 0),
      overdueTasks: overdueTasks.count ?? 0,
      pendingApprovals: pendingApprovals.count ?? 0,
    },
    leadsByStatus: leadRows,
    projectsByStatus: projectRows,
    monthly,
    upcomingTasks: (upcomingTasks.data ?? []) as unknown as { id: string; title: string; due_date: string; status: string; priority: string; project: { name: string } | null }[],
    upcomingProjects: (upcomingProjects.data ?? []) as unknown as { id: string; name: string; due_date: string; status: string; progress: number; client: { company_name: string } | null }[],
    recentLeads: (recentLeads.data ?? []) as unknown as { id: string; company_name: string; contact_person: string | null; source: string | null; status: string; created_at: string }[],
    activity: (activity.data ?? []) as unknown as { id: string; summary: string; created_at: string; actor: { full_name: string } | null }[],
    followUps: (followUps.data ?? []) as { id: string; company_name: string; contact_person: string | null; phone: string | null; email: string | null; next_follow_up: string }[],
    tasksToday: ((upcomingTasks.data ?? []) as unknown as { id: string; title: string; due_date: string; project: { name: string } | null }[]).filter((t) => t.due_date <= today),
    reminders: open.sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6),
  };
}
