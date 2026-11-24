"use client";

import Link from "next/link";
import { CalendarClock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, NativeSelect } from "@/components/app/form";
import { KanbanBoard, COLUMN_ACCENT } from "@/components/app/kanban";
import { ConfirmAction } from "@/components/app/confirm";
import { UserAvatar } from "@/components/app/user-avatar";
import { OPPORTUNITY_STAGE } from "@/lib/constants";
import { formatDate, formatINRCompact, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Option } from "@/features/common/lookups";
import { deleteOpportunity, moveOpportunity, saveOpportunity } from "./actions";

export type Opp = {
  id: string; title: string; value: number; stage: string; lead_id: string | null; client_id: string | null; assigned_to: string | null;
  next_follow_up: string | null; expected_close_date: string | null;
  lead: { company_name: string } | null; client: { company_name: string } | null; assignee: { full_name: string } | null;
};

export function OppFields({ o, leads, clients, staff }: { o?: Opp; leads: Option[]; clients: Option[]; staff: Option[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label="Deal title" required className="sm:col-span-2"><Input name="title" defaultValue={o?.title ?? ""} placeholder="Brand refresh + website" /></Field>
      <Field name="lead_id" label="Lead"><NativeSelect name="lead_id" defaultValue={o?.lead_id ?? ""}><option value="">—</option>{leads.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</NativeSelect></Field>
      <Field name="client_id" label="or existing client"><NativeSelect name="client_id" defaultValue={o?.client_id ?? ""}><option value="">—</option>{clients.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</NativeSelect></Field>
      <Field name="value" label="Estimated value (₹)"><Input name="value" inputMode="decimal" defaultValue={o?.value ?? ""} /></Field>
      <Field name="stage" label="Stage"><NativeSelect name="stage" defaultValue={o?.stage ?? "new"}>{OPPORTUNITY_STAGE.options.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</NativeSelect></Field>
      <Field name="assigned_to" label="Owner"><NativeSelect name="assigned_to" defaultValue={o?.assigned_to ?? ""}><option value="">Unassigned</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</NativeSelect></Field>
      <Field name="next_follow_up" label="Next follow-up"><Input type="date" name="next_follow_up" defaultValue={o?.next_follow_up ?? ""} /></Field>
      <Field name="expected_close_date" label="Expected closing"><Input type="date" name="expected_close_date" defaultValue={o?.expected_close_date ?? ""} /></Field>
    </div>
  );
}

export function PipelineBoard({ opps, leads, clients, staff }: { opps: Opp[]; leads: Option[]; clients: Option[]; staff: Option[] }) {
  return (
    <KanbanBoard
      columns={OPPORTUNITY_STAGE.values.map((v) => ({ id: v, title: OPPORTUNITY_STAGE.label[v], accent: COLUMN_ACCENT[OPPORTUNITY_STAGE.tone[v]] }))}
      items={opps}
      columnOf={(o) => o.stage}
      onMove={(id, to) => moveOpportunity(id, to)}
      canMove={(o, to) => (to === "won" && Number(o.value) <= 0 ? "Add a deal value before marking it won." : null)}
      columnSummary={(items) => { const v = items.reduce((a, o) => a + Number(o.value), 0); return v ? formatINRCompact(v) : null; }}
      renderCard={(o) => {
        const company = o.client?.company_name ?? o.lead?.company_name;
        const href = o.client_id ? `/clients/${o.client_id}` : o.lead_id ? `/leads/${o.lead_id}` : undefined;
        return (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-1">
              <p className="text-sm leading-snug font-medium">{o.title}</p>
              <div className="flex shrink-0" onPointerDown={(e) => e.stopPropagation()}>
                <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="Edit deal"><Pencil /></Button>} title="Edit deal" action={saveOpportunity.bind(null, o.id)}><OppFields o={o} leads={leads} clients={clients} staff={staff} /></FormDialog>
                <ConfirmAction trigger={<Button variant="ghost" size="icon-xs" aria-label="Remove deal" className="text-muted-foreground">×</Button>} title={`Remove “${o.title}”?`} description="The deal is removed from the pipeline. The lead/client is not affected." action={() => deleteOpportunity(o.id)} />
              </div>
            </div>
            {company && (href ? <Link href={href} onPointerDown={(e) => e.stopPropagation()} className="block text-xs text-muted-foreground hover:text-primary">{company}</Link> : <p className="text-xs text-muted-foreground">{company}</p>)}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold tabular-nums">{formatINRCompact(o.value)}</span>
              <div className="flex items-center gap-2">
                {o.next_follow_up && <span className={cn("flex items-center gap-1 text-muted-foreground", o.next_follow_up <= todayISO() && !["won", "lost"].includes(o.stage) && "text-destructive")}><CalendarClock className="size-3" />{formatDate(o.next_follow_up, "dd MMM")}</span>}
                {o.assignee && <UserAvatar name={o.assignee.full_name} className="size-5 text-[9px]" />}
              </div>
            </div>
            {o.expected_close_date && <p className="text-[11px] text-muted-foreground">Close by {formatDate(o.expected_close_date, "dd MMM yyyy")}</p>}
          </div>
        );
      }}
    />
  );
}
