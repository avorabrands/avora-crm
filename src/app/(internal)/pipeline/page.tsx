import type { Metadata } from "next";
import { KanbanSquare, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { FormDialog } from "@/components/app/form";
import { clientOptions, staffOptions } from "@/features/common/lookups";
import { saveOpportunity } from "@/features/pipeline/actions";
import { OppFields, PipelineBoard, type Opp } from "@/features/pipeline/components";

export const metadata: Metadata = { title: "Sales pipeline" };

export default async function PipelinePage() {
  const session = await requireStaff("pipeline.view");
  const supabase = await createClient();
  const [{ data }, { data: leadRows }, clients, staff] = await Promise.all([
    supabase.from("opportunities").select("id, title, value, stage, lead_id, client_id, assigned_to, next_follow_up, expected_close_date, lead:leads(company_name), client:clients(company_name), assignee:profiles!opportunities_assigned_to_fkey(full_name)").order("position").order("created_at", { ascending: false }).limit(500),
    supabase.from("leads").select("id, company_name, code").not("status", "in", "(lost)").order("created_at", { ascending: false }).limit(300),
    clientOptions(), staffOptions(session.orgId),
  ]);
  const opps = (data ?? []) as unknown as Opp[];
  const leads = (leadRows ?? []).map((l) => ({ value: l.id as string, label: `${l.company_name} (${l.code})` }));
  const open = opps.filter((o) => !["won", "lost"].includes(o.stage));
  const won = opps.filter((o) => o.stage === "won");
  const closed = won.length + opps.filter((o) => o.stage === "lost").length;
  const sum = (xs: Opp[]) => xs.reduce((a, o) => a + Number(o.value), 0);

  const add = <FormDialog trigger={<Button><Plus /> Add deal</Button>} title="New deal" action={saveOpportunity.bind(null, null)}><OppFields leads={leads} clients={clients} staff={staff} /></FormDialog>;

  return (
    <>
      <PageHeader title="Sales pipeline" description="Track deal value from first discussion to signature. Drag deals between stages — every move is logged." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Sales pipeline" }]} actions={add} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={formatINR(sum(open))} hint={`${open.length} open deals`} />
        <StatCard label="Weighted forecast" value={formatINR(open.reduce((a, o) => a + Number(o.value) * ({ new: 0.1, discussion: 0.25, quotation_sent: 0.5, negotiation: 0.75 }[o.stage as "new"] ?? 0), 0))} hint="10/25/50/75% by stage" />
        <StatCard label="Won" value={formatINR(sum(won))} hint={`${won.length} deals`} tone="success" />
        <StatCard label="Win rate" value={closed ? `${Math.round((won.length / closed) * 100)}%` : "—"} hint="Won ÷ closed deals" />
      </div>
      {opps.length ? <PipelineBoard opps={opps} leads={leads} clients={clients} staff={staff} /> : <div className="rounded-xl border bg-card"><EmptyState icon={KanbanSquare} title="Your pipeline is empty" description="Add deals for leads you're actively pursuing." action={add} /></div>}
    </>
  );
}
