import { CheckCircle2, MessageSquareWarning } from "lucide-react";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { Pill } from "@/components/app/status-badge";
import { ActionTrigger } from "@/components/app/confirm";
import { formatDateTime } from "@/lib/format";
import { resolveRevision } from "../actions";
import type { ApprovalRow, RevisionRow } from "../queries";

export function ApprovalHistory({ projectId, approvals, revisions }: { projectId: string; approvals: ApprovalRow[]; revisions: RevisionRow[] }) {
  const open = revisions.filter((r) => !r.resolved_at);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title={`Open revision requests (${open.length})`} description="Client feedback that still needs work.">
        {open.length === 0 ? <EmptyState icon={CheckCircle2} title="No open revisions" /> : (
          <ul className="space-y-3">
            {open.map((r) => (
              <li key={r.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{r.deliverable?.name} <Pill tone="amber">Revision {r.revision_number}</Pill></p>
                  <ActionTrigger action={resolveRevision.bind(null, projectId, r.id)} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:underline md:min-h-0 md:px-0">Mark addressed</ActionTrigger>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{r.notes}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.requester?.full_name} · {formatDateTime(r.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Approval & revision history" description="Every client decision with the version it applied to.">
        {approvals.length === 0 ? <EmptyState icon={MessageSquareWarning} title="No decisions yet" description="Send designs to the client to start reviews." /> : (
          <ol className="space-y-4">
            {approvals.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className={`mt-0.5 size-2.5 shrink-0 rounded-full ${a.decision === "approved" ? "bg-emerald-500" : "bg-amber-500"}`} />
                <div className="min-w-0">
                  <p className="text-sm"><span className="font-medium">{a.deliverable?.name}</span> — {a.decision === "approved" ? "approved" : "revision requested"}{a.file_version ? ` (v${a.file_version})` : ""}</p>
                  {a.comment && <p className="text-sm text-muted-foreground">“{a.comment}”</p>}
                  <p className="text-xs text-muted-foreground">{a.decider?.full_name} · {formatDateTime(a.decided_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
