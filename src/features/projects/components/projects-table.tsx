import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { PersonCell } from "@/components/app/user-avatar";
import { SortHeader } from "@/components/app/table-controls";
import { PRIORITY, PROJECT_CATEGORY, PROJECT_STATUS, ACTIVE_PROJECT_STATUSES, type ProjectStatus } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectRow } from "../queries";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{value}%</span>
    </div>
  );
}

function H({ s, col, children, dir }: { s: boolean; col: string; children: React.ReactNode; dir?: "asc" | "desc" }) {
  return s ? <SortHeader column={col} defaultDir={dir}>{children}</SortHeader> : <>{children}</>;
}

export function ProjectsTable({ rows, showClient = true, sortable = true }: { rows: ProjectRow[]; showClient?: boolean; sortable?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4"><H s={sortable} col="name">Project</H></TableHead>
          {showClient && <TableHead>Client</TableHead>}
          <TableHead>Category</TableHead>
          <TableHead><H s={sortable} col="status">Status</H></TableHead>
          <TableHead><H s={sortable} col="priority">Priority</H></TableHead>
          <TableHead className="w-40"><H s={sortable} col="progress" dir="desc">Progress</H></TableHead>
          <TableHead>Manager</TableHead>
          <TableHead className="pr-4"><H s={sortable} col="due_date">Delivery</H></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => {
          const overdue = p.due_date && p.due_date < todayISO() && ACTIVE_PROJECT_STATUSES.includes(p.status as ProjectStatus);
          return (
            <TableRow key={p.id}>
              <TableCell className="pl-4">
                <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary">{p.name}</Link>
                <p className="text-xs text-muted-foreground">{p.code}</p>
              </TableCell>
              {showClient && <TableCell label="Client">{p.client ? <Link href={`/clients/${p.client_id}`} className="hover:text-primary">{p.client.company_name}</Link> : "—"}</TableCell>}
              <TableCell label="Category" className="text-xs text-muted-foreground">{PROJECT_CATEGORY.label[p.category as keyof typeof PROJECT_CATEGORY.label]}</TableCell>
              <TableCell label="Status"><StatusBadge def={PROJECT_STATUS} value={p.status} /></TableCell>
              <TableCell label="Priority"><StatusBadge def={PRIORITY} value={p.priority} /></TableCell>
              <TableCell label="Progress"><ProgressBar value={p.progress} /></TableCell>
              <TableCell label="Manager"><PersonCell name={p.manager?.full_name} /></TableCell>
              <TableCell label="Delivery" className={cn("pr-4 text-sm", overdue && "font-medium text-destructive")}>{formatDate(p.due_date)}{overdue && <span className="block text-xs">Overdue</span>}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
