-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0014 main admin + co-admins.
-- Every admin has full access, but exactly one is the MAIN admin (is_owner).
-- Through the API, only the main admin can: add admins, promote/demote
-- admins, enable/disable admins, or change anything about the main admin.
-- (Server actions using the service role enforce the same rules in code.)
-- ════════════════════════════════════════════════════════════════════════
alter table public.organization_members add column is_owner boolean not null default false;
create unique index organization_members_one_owner on public.organization_members (organization_id) where is_owner;
alter table public.organization_members add constraint member_owner_is_admin check (not is_owner or role = 'admin');

-- the earliest admin of each organisation is its main admin
update public.organization_members m set is_owner = true
where m.id in (select distinct on (organization_id) id from public.organization_members where role = 'admin' order by organization_id, created_at);

create or replace function public.is_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.is_owner and m.status = 'active')
$$;

-- SECURITY INVOKER on purpose: current_user must be the caller's role ('authenticated' for API calls)
create or replace function public.guard_admin_membership()
returns trigger language plpgsql set search_path = '' as $$
declare v_org uuid := coalesce(new.organization_id, old.organization_id); v_owner boolean;
begin
  if current_user <> 'authenticated' then return coalesce(new, old); end if;  -- service role / definer functions
  v_owner := public.is_owner(v_org);
  if tg_op = 'INSERT' then
    if new.is_owner then raise exception 'The main admin can''t be set here' using errcode = '42501'; end if;
    if new.role = 'admin' and not v_owner then raise exception 'Only the main admin can add admins' using errcode = '42501'; end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.is_owner then raise exception 'The main admin can''t be removed' using errcode = '42501'; end if;
    if old.role = 'admin' and not v_owner then raise exception 'Only the main admin can remove admins' using errcode = '42501'; end if;
    return old;
  end if;
  if new.is_owner is distinct from old.is_owner then raise exception 'The main admin can''t be changed here' using errcode = '42501'; end if;
  if old.is_owner and not v_owner then raise exception 'Only the main admin can change the main admin' using errcode = '42501'; end if;
  if (old.role = 'admin' or new.role = 'admin') and not v_owner
     and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'Only the main admin can add, remove, enable or disable admins' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_guard_admin_membership before insert or update or delete on public.organization_members
  for each row execute function public.guard_admin_membership();

revoke execute on function public.is_owner(uuid), public.guard_admin_membership() from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;
