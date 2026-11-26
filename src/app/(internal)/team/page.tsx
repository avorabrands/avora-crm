import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { ROLES, OPEN_TASK_STATUSES, roleLabel } from "@/lib/constants";
import { daysAgoTimestamp, formatDate, todayISO } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { Pill, StatusBadge } from "@/components/app/status-badge";
import { PersonCell } from "@/components/app/user-avatar";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { updateTeamMember } from "@/features/team/actions";
import { AddMemberButton, EditMember, type MemberRow } from "@/features/team/components";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const s = await requireStaff("team.view");
  const supabase = await createClient();
  const since = daysAgoTimestamp(30);
  const [{ data: members }, { data: tasks }, { data: pm }, { data: acts }] = await Promise.all([
    supabase.from("organization_members").select("id, user_id, role, is_owner, department, designation, employee_code, joining_date, status, profile:profiles(full_name, email, phone)").in("role", ["admin", "manager", "team_member"]).order("created_at"),
    supabase.from("tasks").select("assigned_to, status, due_date, completed_at"),
    supabase.from("project_members").select("user_id"),
    supabase.from("activity_logs").select("actor_id").gte("created_at", since),
  ]);
  const rows = (members ?? []) as unknown as MemberRow[];
  const today = todayISO();
  const stat = (uid: string) => {
    const mine = (tasks ?? []).filter((t) => t.assigned_to === uid);
    return {
      open: mine.filter((t) => (OPEN_TASK_STATUSES as string[]).includes(t.status)).length,
      overdue: mine.filter((t) => (OPEN_TASK_STATUSES as string[]).includes(t.status) && t.due_date && t.due_date < today).length,
      done30: mine.filter((t) => t.completed_at && t.completed_at >= since).length,
      projects: (pm ?? []).filter((p) => p.user_id === uid).length,
      activity: (acts ?? []).filter((a) => a.actor_id === uid).length,
    };
  };
  const admin = can(s.role, "team.manage");
  return (
    <>
      <PageHeader title="Team" description="Employees, roles and workload. Open tasks and overdue counts update live." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Team" }]} actions={admin && <AddMemberButton viewerIsOwner={s.isOwner} />} />
      {admin && !isAdminClientConfigured() && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">Creating sign-ins and setting passwords needs <code>SUPABASE_SERVICE_ROLE_KEY</code> on the server. Add it in Vercel → Settings → Environment Variables (see docs/SUPABASE.md).</p>}
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? <EmptyState icon={Users} title="No team members" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="pl-4">Employee</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Joined</TableHead>
              <TableHead className="text-center">Projects</TableHead><TableHead className="text-center">Open tasks</TableHead><TableHead className="text-center">Overdue</TableHead><TableHead className="text-center">Done (30d)</TableHead><TableHead className="text-center">Activity (30d)</TableHead>
              <TableHead>Status</TableHead>{admin && <TableHead className="pr-4"><span className="sr-only">Edit</span></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((m) => {
                const st = stat(m.user_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="pl-4"><PersonCell name={m.profile?.full_name} sub={[m.employee_code, m.profile?.email].filter(Boolean).join(" · ")} /></TableCell>
                    <TableCell label="Role">{m.role === "admin" ? <Pill tone="purple">{roleLabel("admin", m.is_owner)}</Pill> : <StatusBadge def={ROLES} value={m.role} />}</TableCell>
                    <TableCell label="Department" className="text-sm">{m.department ?? "—"}<p className="text-xs text-muted-foreground">{m.designation}</p></TableCell>
                    <TableCell label="Joined" className="text-sm">{formatDate(m.joining_date)}</TableCell>
                    <TableCell label="Projects" className="text-center tabular-nums">{st.projects}</TableCell>
                    <TableCell label="Open tasks" className="text-center tabular-nums">{st.open}</TableCell>
                    <TableCell label="Overdue" className="text-center tabular-nums">{st.overdue ? <Pill tone="red">{st.overdue}</Pill> : 0}</TableCell>
                    <TableCell label="Done (30 days)" className="text-center tabular-nums">{st.done30}</TableCell>
                    <TableCell label="Activity (30 days)" className="text-center tabular-nums">{st.activity}</TableCell>
                    <TableCell label="Status"><Pill tone={m.status === "active" ? "green" : "slate"}>{m.status}</Pill></TableCell>
                    {admin && <TableCell actions className="pr-4"><EditMember m={m} viewerIsOwner={s.isOwner} isSelf={m.id === s.memberId} action={updateTeamMember.bind(null, m.id)} /></TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
