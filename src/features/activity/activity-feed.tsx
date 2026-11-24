import { History } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { UserAvatar } from "@/components/app/user-avatar";
import { Pill } from "@/components/app/status-badge";
import { formatDateTime } from "@/lib/format";
import type { ActivityRow } from "./queries";

export function ActivityFeed({ items, showVisibility = false }: { items: ActivityRow[]; showVisibility?: boolean }) {
  if (!items.length) return <EmptyState icon={History} title="No activity yet" description="Changes, approvals and payments will be recorded here." />;
  return (
    <ol className="space-y-4">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3">
          <UserAvatar name={a.actor?.full_name ?? "System"} />
          <div className="min-w-0">
            <p className="text-sm">{a.summary}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {a.actor?.full_name ?? "System"} · {formatDateTime(a.created_at)}
              {showVisibility && a.client_visible && <Pill tone="teal">Visible to client</Pill>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
