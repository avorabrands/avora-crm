import type { Metadata } from "next";
import { format } from "date-fns";
import { CheckSquare, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { str } from "@/lib/list-params";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { EmptyState } from "@/components/app/empty-state";
import { FormSheet } from "@/components/app/form";
import { Pagination, TableToolbar, ViewSwitch } from "@/components/app/table-controls";
import { deliverableOptions, projectOptions, staffOptions } from "@/features/common/lookups";
import { listTasks } from "@/features/tasks/queries";
import { createTask } from "@/features/tasks/actions";
import { TaskFields } from "@/features/tasks/components/task-form";
import { TaskBoard, TaskCalendar } from "@/features/tasks/components/task-views";
import { TaskTable } from "@/features/tasks/components/task-table";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const session = await requireStaff();
  const sp = await searchParams;
  const view = str(sp, "view") ?? "list";
  const month = str(sp, "month") ?? format(new Date(), "yyyy-MM");
  // team members default to their own tasks
  const effective = session.role === "team_member" && !str(sp, "assignee") ? { ...sp, assignee: "me" } : sp;
  const query = view === "calendar" ? { ...effective, month } : effective;
  const [{ rows, total, params }, staff, projects, deliverables] = await Promise.all([
    listTasks(query, {}, { all: view !== "list", userId: session.userId }),
    staffOptions(session.orgId), projectOptions(), deliverableOptions(),
  ]);
  const canApprove = can(session.role, "tasks.manage");

  const add = (
    <FormSheet trigger={<Button><Plus /> New task</Button>} title="New task" action={createTask}>
      <TaskFields staff={staff} projects={projects} deliverables={deliverables} canApprove={canApprove} />
    </FormSheet>
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        description={session.role === "team_member" ? "Your assigned work. Move tasks to Internal review when they're ready." : "Every task across projects — by list, board or calendar."}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Tasks" }]}
        actions={<>
          <ViewSwitch defaultView="list" views={[{ value: "list", label: "List", icon: "list" }, { value: "board", label: "Board", icon: "board" }, { value: "calendar", label: "Calendar", icon: "calendar" }]} />
          {projects.length > 0 && add}
        </>}
      />
      <Panel bodyClassName="p-0">
        <TableToolbar placeholder="Search tasks…" filters={[
          { name: "assignee", label: "Assignee", options: [{ value: "me", label: "Me" }, { value: "none", label: "Unassigned" }, ...staff] },
          ...(view === "board" ? [] : [{ name: "status", label: "Status", options: [{ value: "open", label: "All open" }, ...TASK_STATUS.options] }]),
          { name: "priority", label: "Priority", options: PRIORITY.options },
          { name: "project", label: "Project", options: projects },
          { name: "overdue", label: "Due", options: [{ value: "1", label: "Overdue only" }] },
        ]} />
        {view === "calendar" ? <TaskCalendar tasks={rows} month={month} />
          : rows.length === 0 ? <EmptyState icon={CheckSquare} title="No tasks found" description={projects.length ? "Create a task or adjust the filters." : "Create a project first, then add tasks to it."} action={projects.length ? add : undefined} />
          : view === "board" ? <div className="p-3"><TaskBoard tasks={rows} canApprove={canApprove} /></div>
          : <><TaskTable rows={rows} canApprove={canApprove} /><Pagination total={total} pageSize={params.pageSize} /></>}
      </Panel>
    </>
  );
}
