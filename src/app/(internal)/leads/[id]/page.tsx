import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Mail, MessageSquare, Phone, RefreshCw, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { LEAD_STATUS } from "@/lib/constants";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { DescriptionList, Panel } from "@/components/app/panel";
import { StatusBadge, Pill } from "@/components/app/status-badge";
import { PersonCell } from "@/components/app/user-avatar";
import { EmptyState } from "@/components/app/empty-state";
import { staffOptions } from "@/features/common/lookups";
import { getLead } from "@/features/leads/queries";
import { addLeadActivity, convertLead, updateLead } from "@/features/leads/actions";
import { ActivityComposer, LeadHeaderActions } from "@/features/leads/components/lead-detail-actions";

export const metadata: Metadata = { title: "Lead" };

const ICON = { note: MessageSquare, call: Phone, email: Mail, meeting: Users, follow_up: CalendarClock, status_change: RefreshCw } as const;

export default async function LeadDetailPage({ params }: PageProps<"/leads/[id]">) {
  const session = await requireStaff("leads.view");
  const { id } = await params;
  const [{ lead, activities }, staff] = await Promise.all([getLead(id), staffOptions(session.orgId)]);
  if (!lead) notFound();

  return (
    <>
      <PageHeader
        title={lead.company_name}
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: lead.code }]}
        meta={<>
          <StatusBadge def={LEAD_STATUS} value={lead.status} />
          {lead.converted_client_id && <Link href={`/clients/${lead.converted_client_id}`}><Pill tone="green">Converted · view client →</Pill></Link>}
          <span className="text-xs text-muted-foreground">Created {formatDate(lead.created_at)}</span>
        </>}
        actions={<LeadHeaderActions lead={lead} staff={staff} update={updateLead.bind(null, lead.id)} convert={convertLead.bind(null, lead.id)} canManage={can(session.role, "leads.manage")} canDelete={can(session.role, "leads.delete")} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Panel title="Lead details">
            <DescriptionList items={[
              { label: "Contact person", value: lead.contact_person },
              { label: "Phone", value: lead.phone && <a href={`tel:${lead.phone}`} className="hover:text-primary">{lead.phone}</a> },
              { label: "Email", value: lead.email && <a href={`mailto:${lead.email}`} className="hover:text-primary">{lead.email}</a> },
              { label: "Location", value: lead.location },
              { label: "Source", value: lead.source },
              { label: "Estimated budget", value: lead.estimated_budget ? formatINR(lead.estimated_budget) : null },
              { label: "Owner", value: <PersonCell name={lead.assignee?.full_name} /> },
              { label: "Next follow-up", value: formatDate(lead.next_follow_up) },
            ]} />
            {lead.services.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">{lead.services.map((s) => <Pill key={s} tone="purple">{s}</Pill>)}</div>
            )}
            {lead.notes && <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-wrap">{lead.notes}</p>}
          </Panel>
        </div>
        <Panel title="Follow-ups & activity" description="Log calls, meetings and notes. Scheduling a follow-up updates the lead and sends a reminder to its owner when due.">
          <ActivityComposer action={addLeadActivity.bind(null, lead.id)} />
          <div className="mt-6 space-y-0">
            {activities.length === 0 ? <EmptyState title="No activity yet" description="Your first note will appear here." /> : activities.map((a) => {
              const Icon = ICON[a.type as keyof typeof ICON] ?? MessageSquare;
              return (
                <div key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
                  <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border last:hidden" />
                  <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card"><Icon className="size-3.5 text-muted-foreground" /></span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm whitespace-pre-wrap">{a.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.author?.full_name ?? "System"} · {formatDateTime(a.created_at)}
                      {a.follow_up_date && <> · follow-up {formatDate(a.follow_up_date)}</>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}
