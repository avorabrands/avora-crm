import { ThumbsUp } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { Pill } from "@/components/app/status-badge";
import { canPreview } from "@/lib/files";
import { portalDeliverables } from "@/features/portal/queries";
import { reviewDeliverable } from "@/features/portal/actions";
import { ReviewBox } from "@/features/portal/components";

export default async function PortalApprovals() {
  await requireClient();
  const pending = await portalDeliverables({ pendingOnly: true });
  const supabase = await createClient();
  const ids = pending.map((d) => d.id);
  const [{ data: versions }, { data: history }] = ids.length ? await Promise.all([
    supabase.from("files").select("id, name, version, created_at, deliverable_id").in("deliverable_id", ids).order("version", { ascending: false }),
    supabase.from("approvals").select("id, decision, comment, decided_at, file_version, deliverable_id").in("deliverable_id", ids).order("decided_at", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];
  return (
    <>
      <PageHeader title="Approvals" description="Review each design, then approve it or tell us what to change. Previous versions remain available below each item." />
      {pending.length === 0 ? <div className="rounded-xl border bg-card"><EmptyState icon={ThumbsUp} title="Nothing waiting for you" description="We'll notify you when new designs are ready." /></div> : (
        <div className="space-y-4">
          {pending.map((d) => {
            const vs = (versions ?? []).filter((v) => v.deliverable_id === d.id);
            const hs = (history ?? []).filter((h) => h.deliverable_id === d.id);
            return (
              <Panel key={d.id} title={d.name} description={`${d.project?.name ?? ""} · submitted ${formatDate(d.submitted_at)}${d.file ? ` · version ${d.file.version}` : ""}`} action={d.revision_count ? <Pill tone="amber">{d.revision_count} revision(s)</Pill> : undefined}>
                <ReviewBox action={reviewDeliverable.bind(null, d.id)} fileId={d.file?.id ?? null} canPreview={canPreview(d.file?.mime_type ?? null)} />
                {(vs.length > 1 || hs.length > 0) && (
                  <div className="mt-4 grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
                    {vs.length > 1 && <div><p className="mb-1 text-xs font-medium text-muted-foreground">Version history</p><ul className="space-y-1">{vs.map((v) => <li key={v.id}><a href={`/api/files/${v.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">v{v.version}</a> <span className="text-xs text-muted-foreground">{formatDate(v.created_at)}</span></li>)}</ul></div>}
                    {hs.length > 0 && <div><p className="mb-1 text-xs font-medium text-muted-foreground">Your earlier feedback</p><ul className="space-y-1.5">{hs.map((h) => <li key={h.id}><span className="font-medium">{h.decision === "approved" ? "Approved" : "Revision"}{h.file_version ? ` (v${h.file_version})` : ""}</span>{h.comment && <> — {h.comment}</>}<p className="text-xs text-muted-foreground">{formatDateTime(h.decided_at)}</p></li>)}</ul></div>}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
