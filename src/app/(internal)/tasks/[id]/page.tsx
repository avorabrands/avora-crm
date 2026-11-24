import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { DescriptionList, Panel } from "@/components/app/panel";
import { StatusBadge } from "@/components/app/status-badge";
import { StatusSelect } from "@/components/app/status-select";
import { PersonCell, UserAvatar } from "@/components/app/user-avatar";
import { FormSheet } from "@/components/app/form";
import { ConfirmAction } from "@/components/app/confirm";
import { deliverableOptions, projectOptions, staffOptions } from "@/features/common/lookups";
import { getTask } from "@/features/tasks/queries";
import { addTaskComment, deleteTaskAndReturn, deleteTaskComment, setTaskStatus, updateTask } from "@/features/tasks/actions";
import { TaskFields } from "@/features/tasks/components/task-form";
import { CommentComposer } from "@/features/tasks/components/comment-composer";
import { listFiles } from "@/features/files/queries";
import { FileList } from "@/features/files/components/file-list";
import { FileUploadDialog } from "@/features/files/components/file-upload";

export const metadata: Metadata = { title: "Task" };

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const session = await requireStaff();
  const { id } = await params;
  const { task, comments } = await getTask(id);
  if (!task) notFound();
  const [staff, projects, deliverables, files] = await Promise.all([staffOptions(session.orgId), projectOptions(), deliverableOptions(task.project_id), listFiles({}, { taskId: id })]);
  const canApprove = can(session.role, "tasks.manage");
  const statusOptions = canApprove ? TASK_STATUS.options : TASK_STATUS.options.filter((o) => ["todo", "in_progress", "internal_review"].includes(o.value));
  const locked = !canApprove && !["todo", "in_progress", "internal_review"].includes(task.status);

  return (
    <>
      <PageHeader
        title={task.title}
        breadcrumbs={[{ label: "Tasks", href: "/tasks" }, ...(task.project ? [{ label: task.project.name, href: `/projects/${task.project_id}?tab=tasks` }] : []), { label: "Task" }]}
        meta={<><StatusBadge def={PRIORITY} value={task.priority} />{task.completed_at && <span className="text-xs text-muted-foreground">Completed {formatDate(task.completed_at)}</span>}</>}
        actions={<>
          {locked ? <StatusBadge def={TASK_STATUS} value={task.status} /> : <StatusSelect value={task.status} options={statusOptions} onChange={setTaskStatus.bind(null, id)} className="h-8" />}
          <FormSheet trigger={<Button variant="outline"><Pencil /> Edit</Button>} title="Edit task" action={updateTask.bind(null, id)}>
            <TaskFields task={task} staff={staff} projects={projects} deliverables={deliverables} canApprove={canApprove} />
          </FormSheet>
          {canApprove && <ConfirmAction trigger={<Button variant="ghost" size="icon" aria-label="Delete task" className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>} title="Delete this task?" description="The task, its comments and attachment links will be removed." action={deleteTaskAndReturn.bind(null, id)} />}
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Description">{task.description ? <p className="text-sm whitespace-pre-wrap">{task.description}</p> : <p className="text-sm text-muted-foreground">No description.</p>}</Panel>
          <Panel title={`Comments (${comments.length})`} description="Internal only — clients never see task comments.">
            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <UserAvatar name={c.author?.full_name} />
                  <div className="min-w-0 flex-1 rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">{c.author?.full_name ?? "Unknown"} <span className="font-normal text-muted-foreground">· {formatDateTime(c.created_at)}</span></p>
                      {(c.author_id === session.userId || canApprove) && (
                        <ConfirmAction trigger={<button className="text-xs text-muted-foreground hover:text-destructive">Delete</button>} title="Delete comment?" description="This cannot be undone." action={deleteTaskComment.bind(null, id, c.id)} />
                      )}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}
              <CommentComposer action={addTaskComment.bind(null, id)} />
            </div>
          </Panel>
          <Panel title="Attachments" action={<FileUploadDialog projectId={task.project_id} taskId={id} defaultFolder="Task attachments" allowShare={false} label="Attach" />} bodyClassName="p-0">
            {files.rows.length ? <FileList files={files.rows} canManage={canApprove} canDelete={can(session.role, "files.delete")} /> : <p className="p-5 text-sm text-muted-foreground">No attachments.</p>}
          </Panel>
        </div>
        <Panel title="Details">
          <DescriptionList columns={1} items={[
            { label: "Project", value: task.project ? <Link href={`/projects/${task.project_id}`} className="text-primary hover:underline">{task.project.name} · {task.project.code}</Link> : null },
            { label: "Deliverable", value: task.deliverable?.name },
            { label: "Assigned to", value: <PersonCell name={task.assignee?.full_name} /> },
            { label: "Start date", value: formatDate(task.start_date) },
            { label: "Due date", value: formatDate(task.due_date) },
            { label: "Created", value: formatDateTime(task.created_at) },
          ]} />
        </Panel>
      </div>
    </>
  );
}
