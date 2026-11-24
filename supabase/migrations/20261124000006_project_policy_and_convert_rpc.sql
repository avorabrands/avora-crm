-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0006
-- 1. projects_select evaluated a separate lookup by id, which cannot see the
--    row being inserted, so INSERT … RETURNING failed. Use the row's columns.
-- 2. convert_lead(): lead → client (+contact, +project) in ONE transaction.
--    SECURITY INVOKER, so every statement still runs under the caller's RLS.
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    public.is_manager(organization_id)
    or (public.is_staff(organization_id) and (
          manager_id = auth.uid()
          or exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid())))
    or (client_visible and client_id = public.portal_client_id(organization_id))
  );

create or replace function public.convert_lead(p_lead uuid, p_project_name text default null,
  p_category public.project_category default 'custom', p_budget numeric default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare l public.leads; c record; v_pid uuid; v_pcode text;
begin
  select * into l from public.leads where id = p_lead for update;
  if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;
  if l.converted_client_id is not null then raise exception 'This lead has already been converted.' using errcode = '22023'; end if;
  if not public.is_manager(l.organization_id) then raise exception 'Only managers can convert leads.' using errcode = '42501'; end if;

  insert into public.clients (organization_id, company_name, contact_person, phone, email, billing_address, account_manager_id, lead_id, notes, created_by)
  values (l.organization_id, l.company_name, l.contact_person, l.phone, l.email, l.location, coalesce(l.assigned_to, auth.uid()), l.id, l.notes, auth.uid())
  returning id, code into c;

  if l.contact_person is not null then
    insert into public.contacts (organization_id, client_id, name, email, phone, is_primary)
    values (l.organization_id, c.id, l.contact_person, l.email, l.phone, true);
  end if;

  update public.leads set status = 'won', converted_client_id = c.id, converted_at = now() where id = l.id;
  update public.opportunities set client_id = c.id, stage = 'won', closed_at = now() where lead_id = l.id;
  update public.quotations set client_id = c.id where lead_id = l.id and client_id is null;
  insert into public.lead_activities (organization_id, lead_id, type, content, created_by)
  values (l.organization_id, l.id, 'status_change', 'Converted to client ' || c.code, auth.uid());
  perform public.log_activity(l.organization_id, 'client', c.id, 'created', 'Lead ' || l.code || ' converted to client ' || c.code, '{}'::jsonb, c.id, null, false);

  if nullif(trim(p_project_name), '') is not null then
    insert into public.projects (organization_id, name, client_id, category, budget, manager_id, lead_id, created_by)
    values (l.organization_id, trim(p_project_name), c.id, p_category, coalesce(p_budget, l.estimated_budget), auth.uid(), l.id, auth.uid())
    returning id, code into v_pid, v_pcode;
    perform public.log_activity(l.organization_id, 'project', v_pid, 'created', 'Project ' || v_pcode || ' created from lead ' || l.code, '{}'::jsonb, c.id, v_pid, false);
  end if;

  return jsonb_build_object('client_id', c.id, 'client_code', c.code, 'project_id', v_pid);
end $$;
revoke execute on function public.convert_lead(uuid, text, public.project_category, numeric) from public, anon;
grant execute on function public.convert_lead(uuid, text, public.project_category, numeric) to authenticated;
