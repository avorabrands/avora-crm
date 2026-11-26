-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0015 a completed project is 100% done.
-- Progress was only calculated from deliverables/tasks, so a project with
-- none (or unfinished ones) stayed at 0% after being marked Completed.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.refresh_project_progress(p_project uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_total int; v_done int; v_pct int; v_status public.project_status; v_mode text;
begin
  select status, progress_mode::text into v_status, v_mode from public.projects where id = p_project;
  if v_status = 'completed' then
    v_pct := 100;
  elsif v_mode <> 'auto' then
    return;
  else
    select count(*), count(*) filter (where approval_status = 'approved' or final_delivered_at is not null)
      into v_total, v_done from public.deliverables where project_id = p_project;
    if v_total = 0 then
      select count(*), count(*) filter (where status in ('approved', 'completed'))
        into v_total, v_done from public.tasks where project_id = p_project;
    end if;
    v_pct := case when v_total = 0 then 0 else round(v_done * 100.0 / v_total) end;
  end if;
  update public.projects set progress = v_pct where id = p_project and progress is distinct from v_pct;
end $$;

create or replace function public.trg_project_mode_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update public.projects set completed_at = now(), progress = 100 where id = new.id;
  elsif (new.progress_mode = 'auto' and old.progress_mode <> 'auto') or (old.status = 'completed' and new.status <> 'completed') then
    -- reopened (or switched back to automatic): recalculate from deliverables / tasks
    perform public.refresh_project_progress(new.id);
  end if;
  return null;
end $$;

-- projects already marked completed
update public.projects set progress = 100 where status = 'completed' and progress <> 100;
