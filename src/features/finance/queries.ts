import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, listParams, str, type ResolvedParams } from "@/lib/list-params";
import { todayISO } from "@/lib/format";

export type QuotationRow = {
  id: string; number: string; title: string; description: string | null; client_id: string | null; lead_id: string | null; project_id: string | null;
  issue_date: string; valid_until: string | null; status: string; tax_mode: string; subtotal: number; discount_total: number; tax_total: number; total: number;
  payment_terms: string | null; terms: string | null; notes: string | null; sent_at: string | null; viewed_at: string | null; responded_at: string | null;
  client_response_note: string | null; created_at: string;
  client: { company_name: string; billing_address: string | null; gstin: string | null; state: string | null; contact_person: string | null; email: string | null } | null;
  lead: { company_name: string } | null; project: { name: string; code: string } | null;
};
export type ItemRow = { id: string; position: number; name: string; description: string | null; hsn_sac?: string | null; quantity: number; unit_price: number; discount_pct: number; tax_rate: number; line_total: number };

const Q_SELECT = "id, number, title, description, client_id, lead_id, project_id, issue_date, valid_until, status, tax_mode, subtotal, discount_total, tax_total, total, payment_terms, terms, notes, sent_at, viewed_at, responded_at, client_response_note, created_at, client:clients(company_name, billing_address, gstin, state, contact_person, email), lead:leads(company_name), project:projects(name, code)";

export async function listQuotations(sp: ResolvedParams, fixed: { clientId?: string; projectId?: string } = {}) {
  const p = listParams(sp, ["created_at", "issue_date", "total", "number", "status"] as const, "created_at");
  const supabase = await createClient();
  let q = supabase.from("quotations").select(Q_SELECT, { count: "exact" });
  if (fixed.clientId) q = q.eq("client_id", fixed.clientId);
  if (fixed.projectId) q = q.eq("project_id", fixed.projectId);
  if (p.q) { const t = ilikeTerm(p.q); q = q.or(`number.ilike.${t},title.ilike.${t}`); }
  const status = str(sp, "status"); if (status) q = q.eq("status", status);
  const client = str(sp, "client"); if (client) q = q.eq("client_id", client);
  const { data, count, error } = await q.order(p.sort, { ascending: p.ascending }).range(p.from, p.to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as QuotationRow[], total: count ?? 0, params: p };
}

export async function getQuotation(id: string) {
  const supabase = await createClient();
  const [{ data: q }, { data: items }] = await Promise.all([
    supabase.from("quotations").select(Q_SELECT).eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("id, position, name, description, quantity, unit_price, discount_pct, tax_rate, line_total").eq("quotation_id", id).order("position"),
  ]);
  return { quotation: q as unknown as QuotationRow | null, items: (items ?? []) as ItemRow[] };
}

export type InvoiceRow = {
  id: string; number: string; client_id: string; project_id: string | null; quotation_id: string | null; milestone_id: string | null; invoice_date: string; due_date: string;
  status: string; tax_mode: string; subtotal: number; discount_total: number; tax_total: number; total: number; amount_paid: number; balance_due: number;
  notes: string | null; terms: string | null; issued_at: string | null; created_at: string;
  client: { company_name: string; billing_address: string | null; gstin: string | null; state: string | null; contact_person: string | null; email: string | null } | null;
  project: { name: string; code: string } | null; quotation: { number: string } | null;
};
const I_SELECT = "id, number, client_id, project_id, quotation_id, milestone_id, invoice_date, due_date, status, tax_mode, subtotal, discount_total, tax_total, total, amount_paid, balance_due, notes, terms, issued_at, created_at, client:clients(company_name, billing_address, gstin, state, contact_person, email), project:projects(name, code), quotation:quotations(number)";

export async function listInvoices(sp: ResolvedParams, fixed: { clientId?: string; projectId?: string } = {}) {
  const p = listParams(sp, ["created_at", "invoice_date", "due_date", "total", "balance_due", "number"] as const, "invoice_date");
  const supabase = await createClient();
  let q = supabase.from("invoices").select(I_SELECT, { count: "exact" });
  if (fixed.clientId) q = q.eq("client_id", fixed.clientId);
  if (fixed.projectId) q = q.eq("project_id", fixed.projectId);
  if (p.q) q = q.ilike("number", ilikeTerm(p.q));
  const status = str(sp, "status");
  if (status === "overdue") q = q.in("status", ["unpaid", "partially_paid"]).lt("due_date", todayISO());
  else if (status === "outstanding") q = q.in("status", ["unpaid", "partially_paid"]);
  else if (status) q = q.eq("status", status);
  const client = str(sp, "client"); if (client) q = q.eq("client_id", client);
  const from = str(sp, "from"); if (from) q = q.gte("invoice_date", from);
  const to = str(sp, "to"); if (to) q = q.lte("invoice_date", to);
  const { data, count, error } = await q.order(p.sort, { ascending: p.ascending }).range(p.from, p.to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as InvoiceRow[], total: count ?? 0, params: p };
}

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const [{ data: inv }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select(I_SELECT).eq("id", id).maybeSingle(),
    supabase.from("invoice_items").select("id, position, name, description, hsn_sac, quantity, unit_price, discount_pct, tax_rate, line_total").eq("invoice_id", id).order("position"),
    supabase.from("payments").select(P_SELECT).eq("invoice_id", id).order("payment_date", { ascending: false }),
  ]);
  return { invoice: inv as unknown as InvoiceRow | null, items: (items ?? []) as ItemRow[], payments: (payments ?? []) as unknown as PaymentRow[] };
}

export type PaymentRow = {
  id: string; receipt_number: string; client_id: string; project_id: string | null; invoice_id: string | null; payment_date: string; amount: number; method: string;
  payment_type: string; transaction_id: string | null; reference_number: string | null; notes: string | null; created_at: string;
  client: { company_name: string; billing_address: string | null; gstin: string | null } | null; invoice: { number: string } | null; project: { name: string } | null; recorder: { full_name: string } | null;
};
const P_SELECT = "id, receipt_number, client_id, project_id, invoice_id, payment_date, amount, method, payment_type, transaction_id, reference_number, notes, created_at, client:clients(company_name, billing_address, gstin), invoice:invoices(number), project:projects(name), recorder:profiles!payments_recorded_by_fkey(full_name)";

export async function listPayments(sp: ResolvedParams, fixed: { clientId?: string; projectId?: string } = {}) {
  const p = listParams(sp, ["payment_date", "amount", "created_at"] as const, "payment_date");
  const supabase = await createClient();
  let q = supabase.from("payments").select(P_SELECT, { count: "exact" });
  if (fixed.clientId) q = q.eq("client_id", fixed.clientId);
  if (fixed.projectId) q = q.eq("project_id", fixed.projectId);
  if (p.q) { const t = ilikeTerm(p.q); q = q.or(`receipt_number.ilike.${t},transaction_id.ilike.${t},reference_number.ilike.${t}`); }
  const method = str(sp, "method"); if (method) q = q.eq("method", method);
  const type = str(sp, "type"); if (type) q = q.eq("payment_type", type);
  const client = str(sp, "client"); if (client) q = q.eq("client_id", client);
  const from = str(sp, "from"); if (from) q = q.gte("payment_date", from);
  const to = str(sp, "to"); if (to) q = q.lte("payment_date", to);
  const { data, count, error } = await q.order(p.sort, { ascending: p.ascending }).range(p.from, p.to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as PaymentRow[], total: count ?? 0, params: p };
}

export async function getPayment(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select(P_SELECT).eq("id", id).maybeSingle();
  return data as unknown as PaymentRow | null;
}

/** Open invoices for the payment form. */
export async function openInvoiceOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("id, number, balance_due, client_id, clients(company_name)").in("status", ["unpaid", "partially_paid"]).order("invoice_date", { ascending: false }).limit(300);
  return (data ?? []).map((i) => ({ value: i.id as string, label: `${i.number} · ${(i.clients as unknown as { company_name: string } | null)?.company_name ?? ""}`, balance: Number(i.balance_due), clientId: i.client_id as string }));
}

export async function listAgreements(sp: ResolvedParams, fixed: { clientId?: string; projectId?: string } = {}) {
  const p = listParams(sp, ["created_at", "signed_date", "end_date", "title"] as const, "created_at");
  const supabase = await createClient();
  let q = supabase.from("agreements").select("id, title, status, start_date, end_date, signed_date, client_visible, notes, client_id, project_id, file_id, created_at, client:clients(company_name), project:projects(name), file:files(id, name)", { count: "exact" });
  if (fixed.clientId) q = q.eq("client_id", fixed.clientId);
  if (fixed.projectId) q = q.eq("project_id", fixed.projectId);
  if (p.q) q = q.ilike("title", ilikeTerm(p.q));
  const status = str(sp, "status"); if (status) q = q.eq("status", status);
  const { data, count, error } = await q.order(p.sort, { ascending: p.ascending, nullsFirst: false }).range(p.from, p.to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AgreementRow[], total: count ?? 0, params: p };
}
export type AgreementRow = {
  id: string; title: string; status: string; start_date: string | null; end_date: string | null; signed_date: string | null; client_visible: boolean; notes: string | null;
  client_id: string; project_id: string | null; file_id: string | null; created_at: string; client: { company_name: string } | null; project: { name: string } | null; file: { id: string; name: string } | null;
};
