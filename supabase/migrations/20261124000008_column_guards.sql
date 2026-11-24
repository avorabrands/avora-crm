-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0008 column-level guards
-- RLS decides WHICH rows a team member may update; these triggers decide
-- WHICH COLUMNS. They only fire for direct API writes (current_user =
-- 'authenticated'); SECURITY DEFINER RPCs such as client_review_deliverable
-- run as the function owner and are validated inside the function instead.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.guard_task_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and not public.is_manager(new.organization_id)
     and new.status in ('client_review', 'approved', 'completed')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'Only managers can move tasks to %', new.status using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_tasks_guard before insert or update of status on public.tasks
  for each row execute function public.guard_task_status();

create or replace function public.guard_deliverable_columns()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and not public.is_manager(old.organization_id) and (
       new.approval_status is distinct from old.approval_status
    or new.client_review_status is distinct from old.client_review_status
    or new.client_visible is distinct from old.client_visible
    or new.revision_count is distinct from old.revision_count
    or new.final_delivered_at is distinct from old.final_delivered_at
    or new.name is distinct from old.name
    or new.project_id is distinct from old.project_id
    or new.organization_id is distinct from old.organization_id) then
    raise exception 'Only managers can change approvals, delivery, visibility or naming of deliverables' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_deliverables_guard before update on public.deliverables
  for each row execute function public.guard_deliverable_columns();

-- files: only managers may flip client visibility or move a file between projects/clients
create or replace function public.guard_file_columns()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and not public.is_manager(old.organization_id) and (
       new.client_visible is distinct from old.client_visible
    or new.project_id is distinct from old.project_id
    or new.client_id is distinct from old.client_id
    or new.storage_path is distinct from old.storage_path) then
    raise exception 'Only managers can share files with clients or move them' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_files_guard before update on public.files
  for each row execute function public.guard_file_columns();

revoke execute on function public.guard_task_status(), public.guard_deliverable_columns(), public.guard_file_columns() from public, anon, authenticated;
