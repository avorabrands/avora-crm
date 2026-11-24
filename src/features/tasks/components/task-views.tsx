"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard, COLUMN_ACCENT } from "@/components/app/kanban";
import { StatusBadge } from "@/components/app/status-badge";
import { UserAvatar } from "@/components/app/user-avatar";
import { PRIORITY, TASK_STATUS, OPEN_TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "../actions";
import type { TaskRow } from "../queries";

const isOverdue = (t: TaskRow) => !!t.due_date && t.due_date < todayISO() && OPEN_TASK_STATUSES.includes(t.status as TaskStatus);

export function TaskBoard({ tasks, canApprove }: { tasks: TaskRow[]; canApprove: boolean }) {
  return (
    <KanbanBoard
      columns={TASK_STATUS.values.map((v) => ({ id: v, title: TASK_STATUS.label[v], accent: COLUMN_ACCENT[TASK_STATUS.tone[v]] }))}
      items={tasks}
      columnOf={(t) => t.status}
      onMove={(id, to) => setTaskStatus(id, to)}
      canMove={(_t, to) => (!canApprove && !["todo", "in_progress", "internal_review"].includes(to) ? "Only managers can approve or complete tasks." : null)}
      renderCard={(t) => (
        <div className="space-y-2">
          <Link href={`/tasks/${t.id}`} onPointerDown={(e) => e.stopPropagation()} className="block text-sm leading-snug font-medium hover:text-primary">{t.title}</Link>
          <p className="truncate text-xs text-muted-foreground">{t.project?.name}{t.deliverable ? ` · ${t.deliverable.name}` : ""}</p>
          <div className="flex items-center justify-between gap-2">
            <StatusBadge def={PRIORITY} value={t.priority} />
            <div className="flex items-center gap-2">
              {t.due_date && <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", isOverdue(t) && "font-medium text-destructive")}><CalendarClock className="size-3" />{formatDate(t.due_date, "dd MMM")}</span>}
              {t.assignee && <UserAvatar name={t.assignee.full_name} className="size-6 text-[10px]" />}
            </div>
          </div>
        </div>
      )}
    />
  );
}

export function TaskCalendar({ tasks, month }: { tasks: TaskRow[]; month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const anchor = parseISO(`${month}-01`);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }) });
  const go = (d: Date) => { const n = new URLSearchParams(params.toString()); n.set("month", format(d, "yyyy-MM")); router.replace(`${pathname}?${n}`, { scroll: false }); };
  const byDay = tasks.reduce<Record<string, TaskRow[]>>((acc, t) => { if (t.due_date) (acc[t.due_date] ??= []).push(t); return acc; }, {});

  return (
    <div>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="font-semibold">{format(anchor, "MMMM yyyy")}</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => go(subMonths(anchor, 1))} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="outline" size="sm" onClick={() => go(new Date())}>Today</Button>
          <Button variant="outline" size="icon-sm" onClick={() => go(addMonths(anchor, 1))} aria-label="Next month"><ChevronRight /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDay[key] ?? [];
          return (
            <div key={key} className={cn("min-h-28 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0", !isSameMonth(d, anchor) && "bg-muted/30 text-muted-foreground")}>
              <p className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs", isToday(d) && "bg-primary font-semibold text-white")}>{format(d, "d")}</p>
              <div className="space-y-1">
                {items.slice(0, 4).map((t) => (
                  <Link key={t.id} href={`/tasks/${t.id}`} title={t.title} className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] font-medium", isOverdue(t) ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : ["approved", "completed"].includes(t.status) ? "bg-emerald-100 text-emerald-700 line-through dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-accent text-accent-foreground")}>
                    {t.title}
                  </Link>
                ))}
                {items.length > 4 && <p className="px-1 text-[11px] text-muted-foreground">+{items.length - 4} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
