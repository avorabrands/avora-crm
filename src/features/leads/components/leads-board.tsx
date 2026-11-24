"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { KanbanBoard, COLUMN_ACCENT } from "@/components/app/kanban";
import { UserAvatar } from "@/components/app/user-avatar";
import { LEAD_STATUS } from "@/lib/constants";
import { formatDate, formatINRCompact, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setLeadStatus } from "../actions";
import type { LeadRow } from "../queries";

export function LeadsBoard({ leads }: { leads: LeadRow[] }) {
  const columns = LEAD_STATUS.values.map((v) => ({ id: v, title: LEAD_STATUS.label[v], accent: COLUMN_ACCENT[LEAD_STATUS.tone[v]] }));
  return (
    <KanbanBoard
      columns={columns}
      items={leads}
      columnOf={(l) => l.status}
      onMove={(id, to) => setLeadStatus(id, to)}
      canMove={(l, to) => (l.converted_client_id && to !== "won" ? "Converted leads stay in Won." : null)}
      columnSummary={(items) => { const sum = items.reduce((a, l) => a + Number(l.estimated_budget ?? 0), 0); return sum ? formatINRCompact(sum) : null; }}
      renderCard={(l) => (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/leads/${l.id}`} className="text-sm leading-snug font-medium hover:text-primary" onPointerDown={(e) => e.stopPropagation()}>{l.company_name}</Link>
            {l.assignee && <UserAvatar name={l.assignee.full_name} className="size-6 text-[10px]" />}
          </div>
          {l.contact_person && <p className="text-xs text-muted-foreground">{l.contact_person}</p>}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium tabular-nums">{l.estimated_budget ? formatINRCompact(l.estimated_budget) : "—"}</span>
            {l.next_follow_up && (
              <span className={cn("flex items-center gap-1 text-muted-foreground", l.next_follow_up <= todayISO() && !["won", "lost"].includes(l.status) && "text-destructive")}>
                <CalendarClock className="size-3" />{formatDate(l.next_follow_up, "dd MMM")}
              </span>
            )}
          </div>
        </div>
      )}
    />
  );
}
