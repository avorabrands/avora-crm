-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0002 helper functions & triggers
-- All SECURITY DEFINER functions pin search_path = '' and fully qualify names.
-- ════════════════════════════════════════════════════════════════════════

-- ── Access helpers (used by RLS) ────────────────────────────────────────
create or replace function public.member_role(p_org uuid)
returns public.app_role language sql stable security definer set search_path = '' as $$
  select m.role from public.organization_members m
  where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active'
$$;

create or replace function public.has_role(p_org uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.member_role(p_org) = any (p_roles), false)
$$;

create or replace function public.is_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_org, array['admin','manager','team_member']::public.app_role[])
$$;

create or replace function public.is_manager(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_org, array['admin','manager']::public.app_role[])
$$;

create or replace function public.is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_org, array['admin']::public.app_role[])
$$;

-- client_id of the calling portal user in an org (null for staff)
create or replace function public.portal_client_id(p_org uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.client_id from public.organization_members m
  where m.organization_id = p_org and m.user_id = auth.uid()
    and m.status = 'active' and m.role = 'client'
$$;

-- staff who may work on a project: admins/managers always, team members if
-- they are the manager or a project member.
create or replace function public.is_project_staff(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and (
      public.is_manager(p.organization_id)
      or (public.has_role(p.organization_id, array['team_member']::public.app_role[]) and (
            p.manager_id = auth.uid()
            or exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid())))
    )
  )
$$;

-- portal user may see a project only if it belongs to their client AND is shared
create or replace function public.is_project_client(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and p.client_visible
      and p.client_id = public.portal_client_id(p.organization_id)
  )
$$;

create or replace function public.can_view_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_project_staff(p_project) or public.is_project_client(p_project)
$$;

-- ── Generic triggers ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','profiles','clients','organization_members','company_settings',
    'leads','contacts','opportunities','projects','project_milestones','deliverables','tasks',
    'quotations','agreements','invoices','payments'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ── New auth user → profile ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email,''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Human-readable numbering (LD-0001, INV-2026-0001 …) ─────────────────
create or replace function public.next_number(p_org uuid, p_kind text, p_period text default '')
returns integer language plpgsql security definer set search_path = '' as $$
declare v integer;
begin
  insert into public.number_sequences (organization_id, kind, period, last_value)
  values (p_org, p_kind, p_period, 1)
  on conflict (organization_id, kind, period)
  do update set last_value = public.number_sequences.last_value + 1
  returning last_value into v;
  return v;
end $$;
revoke execute on function public.next_number(uuid, text, text) from public, anon, authenticated;

create or replace function public.assign_code()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text;
  v_year text := to_char(now(), 'YYYY');
  s public.company_settings;
begin
  select * into s from public.company_settings where organization_id = new.organization_id;
  -- nested IFs: PL/pgSQL resolves NEW.<field> even inside a false AND branch
  case tg_table_name
    when 'leads' then
      if coalesce(new.code, '') = '' then
        new.code := 'LD-' || lpad(public.next_number(new.organization_id, 'lead')::text, 4, '0');
      end if;
    when 'clients' then
      if coalesce(new.code, '') = '' then
        new.code := 'CL-' || lpad(public.next_number(new.organization_id, 'client')::text, 4, '0');
      end if;
    when 'projects' then
      if coalesce(new.code, '') = '' then
        new.code := 'PR-' || lpad(public.next_number(new.organization_id, 'project')::text, 4, '0');
      end if;
    when 'quotations' then
      if coalesce(new.number, '') = '' then
        v_prefix := coalesce(s.quotation_prefix, 'QT');
        new.number := v_prefix || '-' || v_year || '-' || lpad(public.next_number(new.organization_id, 'quotation', v_year)::text, 4, '0');
      end if;
    when 'invoices' then
      if coalesce(new.number, '') = '' then
        v_prefix := coalesce(s.invoice_prefix, 'INV');
        new.number := v_prefix || '-' || v_year || '-' || lpad(public.next_number(new.organization_id, 'invoice', v_year)::text, 4, '0');
      end if;
    when 'payments' then
      if coalesce(new.receipt_number, '') = '' then
        v_prefix := coalesce(s.receipt_prefix, 'RCPT');
        new.receipt_number := v_prefix || '-' || v_year || '-' || lpad(public.next_number(new.organization_id, 'receipt', v_year)::text, 4, '0');
      end if;
  end case;
  return new;
end $$;

alter table public.leads alter column code set default '';
alter table public.clients alter column code set default '';
alter table public.projects alter column code set default '';
alter table public.quotations alter column number set default '';
alter table public.invoices alter column number set default '';
alter table public.payments alter column receipt_number set default '';

create trigger trg_leads_code before insert on public.leads for each row execute function public.assign_code();
create trigger trg_clients_code before insert on public.clients for each row execute function public.assign_code();
create trigger trg_projects_code before insert on public.projects for each row execute function public.assign_code();
create trigger trg_quotations_code before insert on public.quotations for each row execute function public.assign_code();
create trigger trg_invoices_code before insert on public.invoices for each row execute function public.assign_code();
create trigger trg_payments_code before insert on public.payments for each row execute function public.assign_code();

-- ── Quotation & invoice totals ──────────────────────────────────────────
create or replace function public.refresh_quotation_totals(p_quotation uuid)
returns void language sql security definer set search_path = '' as $$
  update public.quotations q set
    subtotal = coalesce(t.sub, 0), discount_total = coalesce(t.disc, 0),
    tax_total = case when q.tax_mode = 'none' then 0 else coalesce(t.tax, 0) end,
    total = coalesce(t.sub, 0) - coalesce(t.disc, 0) + case when q.tax_mode = 'none' then 0 else coalesce(t.tax, 0) end
  from (select sum(line_subtotal) sub, sum(line_discount) disc, sum(line_tax) tax
        from public.quotation_items where quotation_id = p_quotation) t
  where q.id = p_quotation
$$;

create or replace function public.refresh_invoice(p_invoice uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_paid numeric(14,2);
begin
  update public.invoices i set
    subtotal = coalesce(t.sub, 0), discount_total = coalesce(t.disc, 0),
    tax_total = case when i.tax_mode = 'none' then 0 else coalesce(t.tax, 0) end,
    total = coalesce(t.sub, 0) - coalesce(t.disc, 0) + case when i.tax_mode = 'none' then 0 else coalesce(t.tax, 0) end
  from (select sum(line_subtotal) sub, sum(line_discount) disc, sum(line_tax) tax
        from public.invoice_items where invoice_id = p_invoice) t
  where i.id = p_invoice;

  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = p_invoice;

  update public.invoices i set
    amount_paid = v_paid,
    status = case
      when i.status in ('draft', 'cancelled') then i.status
      when i.total > 0 and v_paid >= i.total then 'paid'::public.invoice_status
      when v_paid > 0 then 'partially_paid'::public.invoice_status
      else 'unpaid'::public.invoice_status end
  where i.id = p_invoice;
end $$;

create or replace function public.trg_quotation_items_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_quotation_totals(coalesce(new.quotation_id, old.quotation_id));
  return null;
end $$;
create trigger trg_quotation_items_totals after insert or update or delete on public.quotation_items
  for each row execute function public.trg_quotation_items_changed();

create or replace function public.trg_quotation_tax_mode()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tax_mode is distinct from old.tax_mode then perform public.refresh_quotation_totals(new.id); end if;
  return null;
end $$;
create trigger trg_quotations_tax_mode after update of tax_mode on public.quotations
  for each row execute function public.trg_quotation_tax_mode();

create or replace function public.trg_invoice_items_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_invoice(coalesce(new.invoice_id, old.invoice_id));
  return null;
end $$;
create trigger trg_invoice_items_totals after insert or update or delete on public.invoice_items
  for each row execute function public.trg_invoice_items_changed();

create or replace function public.trg_invoice_header_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tax_mode is distinct from old.tax_mode or new.status is distinct from old.status then
    perform public.refresh_invoice(new.id);
  end if;
  return null;
end $$;
create trigger trg_invoices_header after update of tax_mode, status on public.invoices
  for each row when (pg_trigger_depth() < 2)
  execute function public.trg_invoice_header_changed();

-- payments: validate against invoice, then refresh invoice balance
create or replace function public.trg_payments_validate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare inv public.invoices; v_other numeric(14,2);
begin
  if new.invoice_id is not null then
    select * into inv from public.invoices where id = new.invoice_id;
    if inv.client_id <> new.client_id then
      raise exception 'Payment client does not match the invoice client' using errcode = '23514';
    end if;
    if inv.status in ('draft', 'cancelled') then
      raise exception 'Cannot record a payment against a % invoice', inv.status using errcode = '23514';
    end if;
    select coalesce(sum(amount), 0) into v_other from public.payments
      where invoice_id = new.invoice_id and id <> new.id;
    if v_other + new.amount > inv.total then
      raise exception 'Payment exceeds the outstanding balance (₹%)', inv.total - v_other using errcode = '23514';
    end if;
    new.project_id := coalesce(new.project_id, inv.project_id);
  end if;
  return new;
end $$;
create trigger trg_payments_validate before insert or update on public.payments
  for each row execute function public.trg_payments_validate();

create or replace function public.trg_payments_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' and old.invoice_id is not null then perform public.refresh_invoice(old.invoice_id); end if;
  if tg_op <> 'DELETE' and new.invoice_id is not null then perform public.refresh_invoice(new.invoice_id); end if;
  return null;
end $$;
create trigger trg_payments_refresh after insert or update or delete on public.payments
  for each row execute function public.trg_payments_changed();

-- ── Project progress (from deliverables, else tasks) ────────────────────
create or replace function public.refresh_project_progress(p_project uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_total int; v_done int; v_pct int;
begin
  if (select progress_mode from public.projects where id = p_project) <> 'auto' then return; end if;
  select count(*), count(*) filter (where approval_status = 'approved' or final_delivered_at is not null)
    into v_total, v_done from public.deliverables where project_id = p_project;
  if v_total = 0 then
    select count(*), count(*) filter (where status in ('approved', 'completed'))
      into v_total, v_done from public.tasks where project_id = p_project;
  end if;
  v_pct := case when v_total = 0 then 0 else round(v_done * 100.0 / v_total) end;
  update public.projects set progress = v_pct where id = p_project and progress <> v_pct;
end $$;

create or replace function public.trg_progress_source_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then perform public.refresh_project_progress(old.project_id); end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.project_id is distinct from old.project_id) then
    perform public.refresh_project_progress(new.project_id);
  end if;
  return null;
end $$;
create trigger trg_deliverables_progress after insert or delete or update of approval_status, final_delivered_at, project_id
  on public.deliverables for each row execute function public.trg_progress_source_changed();
create trigger trg_tasks_progress after insert or delete or update of status, project_id
  on public.tasks for each row execute function public.trg_progress_source_changed();

create or replace function public.trg_project_mode_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.progress_mode = 'auto' and old.progress_mode <> 'auto' then perform public.refresh_project_progress(new.id); end if;
  if new.status = 'completed' and old.status <> 'completed' then
    update public.projects set completed_at = now() where id = new.id;
  end if;
  return null;
end $$;
create trigger trg_projects_mode after update of progress_mode, status on public.projects
  for each row when (pg_trigger_depth() < 2) execute function public.trg_project_mode_changed();

-- timestamps on state transitions
create or replace function public.trg_task_completed_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then new.completed_at := now();
  elsif new.status <> 'completed' then new.completed_at := null; end if;
  return new;
end $$;
create trigger trg_tasks_completed before insert or update of status on public.tasks
  for each row execute function public.trg_task_completed_at();

create or replace function public.trg_deliverable_approved_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.approval_status = 'approved' and (tg_op = 'INSERT' or old.approval_status <> 'approved') then new.approved_at := now();
  elsif new.approval_status <> 'approved' then new.approved_at := null; end if;
  return new;
end $$;
create trigger trg_deliverables_approved before insert or update of approval_status on public.deliverables
  for each row execute function public.trg_deliverable_approved_at();

-- keep a file's version chain consistent: only the newest version is_latest
create or replace function public.trg_files_versioning()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.root_file_id is not null then
    update public.files set is_latest = false
      where (id = new.root_file_id or root_file_id = new.root_file_id) and id <> new.id and is_latest;
  end if;
  return null;
end $$;
create trigger trg_files_versioning after insert on public.files
  for each row execute function public.trg_files_versioning();

-- ── Notifications ───────────────────────────────────────────────────────
create or replace function public.notify(p_org uuid, p_user uuid, p_type text, p_title text,
  p_body text default null, p_link text default null, p_entity_type text default null, p_entity_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (organization_id, user_id, type, title, body, link, entity_type, entity_id)
  values (p_org, p_user, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id);
end $$;
revoke execute on function public.notify(uuid, uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

-- notify every active admin (optionally managers too)
create or replace function public.notify_role(p_org uuid, p_roles public.app_role[], p_type text, p_title text,
  p_body text, p_link text, p_entity_type text, p_entity_id uuid, p_except uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select user_id from public.organization_members
           where organization_id = p_org and role = any (p_roles) and status = 'active'
             and user_id is distinct from p_except loop
    perform public.notify(p_org, r.user_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id);
  end loop;
end $$;
revoke execute on function public.notify_role(uuid, public.app_role[], text, text, text, text, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.trg_notify_lead_assigned()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform public.notify(new.organization_id, new.assigned_to, 'lead_assigned',
      'New lead assigned: ' || new.company_name, new.code, '/leads/' || new.id, 'lead', new.id);
  end if;
  return null;
end $$;
create trigger trg_leads_notify after insert or update of assigned_to on public.leads
  for each row execute function public.trg_notify_lead_assigned();

create or replace function public.trg_notify_task_assigned()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform public.notify(new.organization_id, new.assigned_to, 'task_assigned',
      'Task assigned: ' || new.title,
      case when new.due_date is not null then 'Due ' || to_char(new.due_date, 'DD Mon YYYY') end,
      '/tasks/' || new.id, 'task', new.id);
  end if;
  return null;
end $$;
create trigger trg_tasks_notify after insert or update of assigned_to on public.tasks
  for each row execute function public.trg_notify_task_assigned();

create or replace function public.trg_notify_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d record;
begin
  select dl.name, dl.assigned_to, p.id project_id, p.manager_id, p.name project_name
    into d from public.deliverables dl join public.projects p on p.id = dl.project_id
    where dl.id = new.deliverable_id;
  perform public.notify(new.organization_id, d.manager_id,
    case when new.decision = 'approved' then 'deliverable_approved' else 'client_feedback' end,
    case when new.decision = 'approved' then 'Approved: ' || d.name else 'Revision requested: ' || d.name end,
    coalesce(left(new.comment, 200), d.project_name), '/projects/' || d.project_id || '?tab=approvals', 'deliverable', new.deliverable_id);
  if d.assigned_to is distinct from d.manager_id then
    perform public.notify(new.organization_id, d.assigned_to,
      case when new.decision = 'approved' then 'deliverable_approved' else 'client_feedback' end,
      case when new.decision = 'approved' then 'Approved: ' || d.name else 'Revision requested: ' || d.name end,
      coalesce(left(new.comment, 200), d.project_name), '/projects/' || d.project_id || '?tab=deliverables', 'deliverable', new.deliverable_id);
  end if;
  return null;
end $$;
create trigger trg_approvals_notify after insert on public.approvals
  for each row execute function public.trg_notify_approval();

create or replace function public.trg_notify_quotation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    perform public.notify_role(new.organization_id, array['admin','manager']::public.app_role[], 'quotation_accepted',
      'Quotation accepted: ' || new.number, new.title, '/quotations/' || new.id, 'quotation', new.id, null);
  elsif new.status = 'rejected' and old.status <> 'rejected' then
    perform public.notify_role(new.organization_id, array['admin','manager']::public.app_role[], 'quotation_rejected',
      'Quotation rejected: ' || new.number, coalesce(new.client_response_note, new.title), '/quotations/' || new.id, 'quotation', new.id, null);
  end if;
  return null;
end $$;
create trigger trg_quotations_notify after update of status on public.quotations
  for each row execute function public.trg_notify_quotation();

create or replace function public.trg_notify_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_client text;
begin
  select company_name into v_client from public.clients where id = new.client_id;
  perform public.notify_role(new.organization_id, array['admin']::public.app_role[], 'payment_recorded',
    'Payment recorded: ₹' || to_char(new.amount, 'FM99,99,99,99,990.00'), v_client || ' · ' || new.receipt_number,
    '/payments?q=' || new.receipt_number, 'payment', new.id, auth.uid());
  return null;
end $$;
create trigger trg_payments_notify after insert on public.payments
  for each row execute function public.trg_notify_payment();

-- Time-based reminders. Idempotent per entity per day; schedule it with
-- pg_cron (see docs/SUPABASE.md) or call /api/cron/reminders from Vercel Cron.
create or replace function public.generate_due_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  -- lead follow-ups due today or earlier
  for r in select l.* from public.leads l
           where l.next_follow_up <= current_date and l.status not in ('won','lost') and l.assigned_to is not null
             and not exists (select 1 from public.notifications x where x.entity_id = l.id and x.type = 'follow_up_due' and x.created_at::date = current_date) loop
    perform public.notify(r.organization_id, r.assigned_to, 'follow_up_due', 'Follow-up due: ' || r.company_name,
      'Scheduled for ' || to_char(r.next_follow_up, 'DD Mon'), '/leads/' || r.id, 'lead', r.id); n := n + 1;
  end loop;
  -- tasks due within 2 days
  for r in select t.* from public.tasks t
           where t.due_date between current_date and current_date + 2 and t.status not in ('approved','completed') and t.assigned_to is not null
             and not exists (select 1 from public.notifications x where x.entity_id = t.id and x.type = 'deadline_approaching' and x.created_at::date = current_date) loop
    perform public.notify(r.organization_id, r.assigned_to, 'deadline_approaching', 'Deadline approaching: ' || r.title,
      'Due ' || to_char(r.due_date, 'DD Mon'), '/tasks/' || r.id, 'task', r.id); n := n + 1;
  end loop;
  -- overdue tasks (once)
  for r in select t.* from public.tasks t
           where t.due_date < current_date and t.status not in ('approved','completed') and t.assigned_to is not null
             and not exists (select 1 from public.notifications x where x.entity_id = t.id and x.type = 'task_overdue') loop
    perform public.notify(r.organization_id, r.assigned_to, 'task_overdue', 'Task overdue: ' || r.title,
      'Was due ' || to_char(r.due_date, 'DD Mon'), '/tasks/' || r.id, 'task', r.id); n := n + 1;
  end loop;
  -- overdue invoices (once) → admins
  for r in select i.*, c.company_name from public.invoices i join public.clients c on c.id = i.client_id
           where i.due_date < current_date and i.status in ('unpaid','partially_paid')
             and not exists (select 1 from public.notifications x where x.entity_id = i.id and x.type = 'invoice_overdue') loop
    perform public.notify_role(r.organization_id, array['admin']::public.app_role[], 'invoice_overdue',
      'Invoice overdue: ' || r.number, r.company_name || ' · balance ₹' || to_char(r.balance_due, 'FM99,99,99,99,990.00'),
      '/invoices/' || r.id, 'invoice', r.id, null); n := n + 1;
  end loop;
  -- expire quotations past validity
  update public.quotations set status = 'expired'
    where status in ('sent','viewed') and valid_until < current_date;
  return n;
end $$;
revoke execute on function public.generate_due_reminders() from public, anon, authenticated;

-- ── Activity log helper (callable by staff from the app) ────────────────
create or replace function public.log_activity(p_org uuid, p_entity_type text, p_entity_id uuid, p_action text,
  p_summary text, p_metadata jsonb default '{}'::jsonb, p_client uuid default null, p_project uuid default null,
  p_client_visible boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_staff(p_org) or public.portal_client_id(p_org) is not null) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  -- portal users may only log against their own client, and only visible entries
  if not public.is_staff(p_org) then
    p_client := public.portal_client_id(p_org);
    p_client_visible := true;
  end if;
  insert into public.activity_logs (organization_id, actor_id, entity_type, entity_id, action, summary, metadata, client_id, project_id, client_visible)
  values (p_org, auth.uid(), p_entity_type, p_entity_id, p_action, p_summary, coalesce(p_metadata, '{}'::jsonb), p_client, p_project, p_client_visible);
end $$;

-- ── Client portal RPCs (the only way portal users change anything) ──────
create or replace function public.client_review_deliverable(p_deliverable uuid, p_decision public.approval_status, p_comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d record; v_approval uuid; v_file record; v_staff boolean;
begin
  if p_decision not in ('approved', 'revision_requested') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  select dl.*, p.client_id, p.client_visible project_visible into d
    from public.deliverables dl join public.projects p on p.id = dl.project_id where dl.id = p_deliverable;
  if not found then raise exception 'Deliverable not found' using errcode = 'P0002'; end if;

  v_staff := public.is_manager(d.organization_id);
  if not v_staff and not (d.client_visible and d.project_visible and d.client_id = public.portal_client_id(d.organization_id)) then
    raise exception 'You do not have access to this deliverable' using errcode = '42501';
  end if;
  if d.approval_status = 'approved' then
    raise exception 'This deliverable is already approved' using errcode = '22023';
  end if;
  if p_decision = 'revision_requested' and coalesce(trim(p_comment), '') = '' then
    raise exception 'Please describe the changes you need' using errcode = '22023';
  end if;

  select id, version into v_file from public.files where id = d.current_file_id;

  insert into public.approvals (organization_id, deliverable_id, file_id, file_version, decision, comment, decided_by)
  values (d.organization_id, d.id, v_file.id, v_file.version, p_decision, nullif(trim(p_comment), ''), auth.uid())
  returning id into v_approval;

  if p_decision = 'approved' then
    update public.deliverables set approval_status = 'approved', client_review_status = 'approved' where id = d.id;
  else
    update public.deliverables set approval_status = 'revision_requested', client_review_status = 'changes_requested',
      design_status = 'in_progress', revision_count = revision_count + 1 where id = d.id;
    insert into public.revisions (organization_id, deliverable_id, approval_id, revision_number, notes, requested_by)
    values (d.organization_id, d.id, v_approval, d.revision_count + 1, trim(p_comment), auth.uid());
  end if;

  insert into public.activity_logs (organization_id, actor_id, entity_type, entity_id, action, summary, client_id, project_id, client_visible)
  values (d.organization_id, auth.uid(), 'deliverable', d.id,
    case when p_decision = 'approved' then 'approved' else 'revision_requested' end,
    case when p_decision = 'approved' then 'Approved "' || d.name || '"' else 'Requested a revision on "' || d.name || '"' end,
    d.client_id, d.project_id, true);
  return v_approval;
end $$;

create or replace function public.client_mark_quotation_viewed(p_quotation uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.quotations q set status = 'viewed', viewed_at = now()
  where q.id = p_quotation and q.status = 'sent'
    and q.client_id = public.portal_client_id(q.organization_id);
end $$;

create or replace function public.client_respond_quotation(p_quotation uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare q public.quotations;
begin
  select * into q from public.quotations where id = p_quotation;
  if not found or q.client_id is distinct from public.portal_client_id(q.organization_id) then
    raise exception 'Quotation not found' using errcode = '42501';
  end if;
  if q.status not in ('sent', 'viewed') then
    raise exception 'This quotation can no longer be responded to' using errcode = '22023';
  end if;
  if q.valid_until is not null and q.valid_until < current_date then
    update public.quotations set status = 'expired' where id = q.id;
    raise exception 'This quotation has expired' using errcode = '22023';
  end if;
  update public.quotations set status = case when p_accept then 'accepted'::public.quotation_status else 'rejected'::public.quotation_status end,
    responded_at = now(), client_response_note = nullif(trim(p_note), '') where id = q.id;
  insert into public.activity_logs (organization_id, actor_id, entity_type, entity_id, action, summary, client_id, project_id, client_visible)
  values (q.organization_id, auth.uid(), 'quotation', q.id, case when p_accept then 'accepted' else 'rejected' end,
    case when p_accept then 'Accepted quotation ' else 'Declined quotation ' end || q.number, q.client_id, q.project_id, true);
end $$;
