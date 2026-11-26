-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0013 lead portal logins.
-- A lead can be given a sign-in that shows ONLY the quotations sent to them
-- (view, download, accept/decline). Converting the lead to a client turns
-- the same login into a normal client-portal login.
-- ════════════════════════════════════════════════════════════════════════
alter table public.organization_members add column lead_id uuid references public.leads (id) on delete cascade;
create index organization_members_lead_idx on public.organization_members (lead_id) where lead_id is not null;
alter table public.organization_members
  add constraint member_lead_link check ((role = 'lead') = (lead_id is not null));

-- the lead the signed-in user represents (null for everyone else)
create or replace function public.portal_lead_id(p_org uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.lead_id from public.organization_members m
  where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active' and m.role = 'lead'
$$;

-- what the lead portal shows about "you" (leads table itself stays staff-only)
create or replace function public.lead_portal_me()
returns table (organization_id uuid, lead_id uuid, company_name text, contact_person text, email text, phone text, location text, code text)
language sql stable security definer set search_path = '' as $$
  select l.organization_id, l.id, l.company_name, l.contact_person, l.email, l.phone, l.location, l.code
  from public.organization_members m join public.leads l on l.id = m.lead_id
  where m.user_id = auth.uid() and m.role = 'lead' and m.status = 'active'
$$;

-- quotations: leads see their own non-draft quotations (items follow via quotation_items_select)
drop policy quotations_select on public.quotations;
create policy quotations_select on public.quotations for select to authenticated
  using (public.is_manager(organization_id)
         or (status <> 'draft' and client_id = public.portal_client_id(organization_id))
         or (status <> 'draft' and lead_id is not null and lead_id = public.portal_lead_id(organization_id)));

create or replace function public.portal_owns_quotation(p_org uuid, p_client uuid, p_lead uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (p_client is not null and p_client = public.portal_client_id(p_org))
      or (p_lead is not null and p_lead = public.portal_lead_id(p_org))
$$;

create or replace function public.client_mark_quotation_viewed(p_quotation uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.quotations q set status = 'viewed', viewed_at = now()
  where q.id = p_quotation and q.status = 'sent'
    and public.portal_owns_quotation(q.organization_id, q.client_id, q.lead_id);
end $$;

create or replace function public.client_respond_quotation(p_quotation uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare q public.quotations;
begin
  select * into q from public.quotations where id = p_quotation;
  if not found or not public.portal_owns_quotation(q.organization_id, q.client_id, q.lead_id) then
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

-- called by convert_lead (which runs as the manager, who can't update memberships directly)
create or replace function public.promote_lead_logins(p_lead uuid, p_client uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.leads l where l.id = p_lead and l.converted_client_id = p_client and public.is_manager(l.organization_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.organization_members set role = 'client', client_id = p_client, lead_id = null
  where lead_id = p_lead and role = 'lead';
end $$;

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
  -- lead portal logins become client portal logins for the new client
  perform public.promote_lead_logins(l.id, c.id);
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

revoke execute on function public.portal_lead_id(uuid), public.lead_portal_me(), public.portal_owns_quotation(uuid, uuid, uuid),
  public.promote_lead_logins(uuid, uuid), public.client_mark_quotation_viewed(uuid), public.client_respond_quotation(uuid, boolean, text),
  public.convert_lead(uuid, text, public.project_category, numeric) from public, anon;
grant execute on function public.portal_lead_id(uuid), public.lead_portal_me(), public.portal_owns_quotation(uuid, uuid, uuid),
  public.promote_lead_logins(uuid, uuid), public.client_mark_quotation_viewed(uuid), public.client_respond_quotation(uuid, boolean, text),
  public.convert_lead(uuid, text, public.project_category, numeric) to authenticated;
