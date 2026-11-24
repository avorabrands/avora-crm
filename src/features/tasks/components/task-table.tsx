import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { StatusSelect } from "@/components/app/status-select";
import { PersonCell } from "@/components/app/user-avatar";
import { SortHeader } from "@/components/app/table-controls";
import { PRIORITY, TASK_STATUS, OPEN_TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "../actions";
import type { TaskRow } from "../queries";

export function TaskTable({ rows, canApprove, showProject = true }: { rows: TaskRow[]; canApprove: boolean; showProject?: boolean }) {
  const options = canApprove ? TASK_STATUS.options : TASK_STATUS.options.filter((o) => ["todo", "in_progress", "internal_review"].includes(o.value));
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead className="pl-4"><SortHeader column="title">Task</SortHeader></TableHead>
        {showProject && <TableHead>Project</TableHead>}
        <TableHead>Assignee</TableHead>
        <TableHead><SortHeader column="priority">Priority</SortHeader></TableHead>
        <TableHead><SortHeader column="status">Status</SortHeader></TableHead>
        <TableHead className="pr-4"><SortHeader column="due_date">Due</SortHeader></TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((t) => {
          const overdue = t.due_date && t.due_date < todayISO() && OPEN_TASK_STATUSES.includes(t.status as TaskStatus);
          const locked = !canApprove && !["todo", "in_progress", "internal_review"].includes(t.status);
          return (
            <TableRow key={t.id}>
              <TableCell className="max-w-80 pl-4"><Link href={`/tasks/${t.id}`} className="font-medium hover:text-primary">{t.title}</Link>{t.deliverable && <p className="truncate text-xs text-muted-foreground">{t.deliverable.name}</p>}</TableCell>
              {showProject && <TableCell className="text-sm">{t.project ? <Link href={`/projects/${t.project_id}?tab=tasks`} className="hover:text-primary">{t.project.name}</Link> : "—"}</TableCell>}
              <TableCell><PersonCell name={t.assignee?.full_name} /></TableCell>
              <TableCell><StatusBadge def={PRIORITY} value={t.priority} /></TableCell>
              <TableCell>{locked ? <StatusBadge def={TASK_STATUS} value={t.status} /> : <StatusSelect value={t.status} options={options} onChange={setTaskStatus.bind(null, t.id)} />}</TableCell>
              <TableCell className={cn("pr-4 text-sm", overdue && "font-medium text-destructive")}>{formatDate(t.due_date)}{overdue && <span className="block text-xs">Overdue</span>}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
