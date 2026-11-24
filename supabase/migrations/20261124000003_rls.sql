-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0003 Row Level Security
-- Role matrix (enforced here, mirrored in src/lib/auth/permissions.ts):
--   admin        everything, incl. users, settings, profitability, deletes
--   manager      sales, clients, projects, quotations, invoices, payments
--   team_member  only projects they manage/are members of, their tasks/leads
--   client       portal only: own shared projects, deliverables, files,
--                non-draft quotations/invoices, own payments — never
--                internal notes, comments, team data or financials
-- ════════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['organizations','profiles','organization_members','company_settings','number_sequences',
    'clients','leads','lead_activities','contacts','opportunities','projects','project_financials','project_members',
    'project_milestones','deliverables','tasks','task_comments','files','approvals','revisions','quotations',
    'quotation_items','agreements','invoices','invoice_items','payments','notifications','notification_deliveries','activity_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ── Tenancy ─────────────────────────────────────────────────────────────
create policy org_select on public.organizations for select to authenticated
  using (public.member_role(id) is not null);
create policy org_update on public.organizations for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

create or replace function public.shares_org_with(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  -- caller is staff in an org where p_user is a member
  select exists (
    select 1 from public.organization_members them
    join public.organization_members me on me.organization_id = them.organization_id
    where them.user_id = p_user and me.user_id = auth.uid() and me.status = 'active'
      and me.role in ('admin','manager','team_member'))
$$;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy members_select on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_staff(organization_id));
create policy members_admin_insert on public.organization_members for insert to authenticated
  with check (public.is_admin(organization_id));
create policy members_admin_update on public.organization_members for update to authenticated
  using (public.is_admin(organization_id)) with check (public.is_admin(organization_id));
create policy members_admin_delete on public.organization_members for delete to authenticated
  using (public.is_admin(organization_id) and user_id <> auth.uid());

create policy settings_select on public.company_settings for select to authenticated
  using (public.member_role(organization_id) is not null);
create policy settings_admin_write on public.company_settings for all to authenticated
  using (public.is_admin(organization_id)) with check (public.is_admin(organization_id));
-- number_sequences: no policies → only SECURITY DEFINER functions touch it.

-- ── Clients (staff only; portal users use portal_me()) ──────────────────
create policy clients_staff_select on public.clients for select to authenticated
  using (public.is_staff(organization_id));
create policy clients_manager_insert on public.clients for insert to authenticated
  with check (public.is_manager(organization_id));
create policy clients_manager_update on public.clients for update to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));
create policy clients_admin_delete on public.clients for delete to authenticated
  using (public.is_admin(organization_id));

create or replace function public.portal_me()
returns table (organization_id uuid, client_id uuid, company_name text, contact_person text, email text,
               phone text, billing_address text, gstin text, code text)
language sql stable security definer set search_path = '' as $$
  select c.organization_id, c.id, c.company_name, c.contact_person, c.email, c.phone, c.billing_address, c.gstin, c.code
  from public.organization_members m join public.clients c on c.id = m.client_id
  where m.user_id = auth.uid() and m.role = 'client' and m.status = 'active'
$$;

-- ── Sales (managers; team members only their assigned leads) ────────────
create policy leads_select on public.leads for select to authenticated
  using (public.is_manager(organization_id) or (assigned_to = auth.uid() and public.is_staff(organization_id)));
create policy leads_insert on public.leads for insert to authenticated
  with check (public.is_manager(organization_id));
create policy leads_update on public.leads for update to authenticated
  using (public.is_manager(organization_id) or (assigned_to = auth.uid() and public.is_staff(organization_id)))
  with check (public.is_staff(organization_id));
create policy leads_delete on public.leads for delete to authenticated
  using (public.is_admin(organization_id));

create policy lead_activities_select on public.lead_activities for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy lead_activities_insert on public.lead_activities for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.leads l where l.id = lead_id and l.organization_id = lead_activities.organization_id));
create policy lead_activities_delete on public.lead_activities for delete to authenticated
  using (created_by = auth.uid() or public.is_admin(organization_id));

create policy contacts_select on public.contacts for select to authenticated
  using (public.is_staff(organization_id));
create policy contacts_write on public.contacts for all to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));

create policy opportunities_select on public.opportunities for select to authenticated
  using (public.is_manager(organization_id) or (assigned_to = auth.uid() and public.is_staff(organization_id)));
create policy opportunities_write on public.opportunities for insert to authenticated
  with check (public.is_manager(organization_id));
create policy opportunities_update on public.opportunities for update to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));
create policy opportunities_delete on public.opportunities for delete to authenticated
  using (public.is_manager(organization_id));

-- ── Projects ────────────────────────────────────────────────────────────
create policy projects_select on public.projects for select to authenticated
  using (public.can_view_project(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_manager(organization_id));
create policy projects_update on public.projects for update to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_admin(organization_id));

create policy financials_admin on public.project_financials for all to authenticated
  using (public.is_admin(organization_id)) with check (public.is_admin(organization_id));

create policy project_members_select on public.project_members for select to authenticated
  using (public.is_project_staff(project_id));
create policy project_members_write on public.project_members for all to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));

create policy milestones_select on public.project_milestones for select to authenticated
  using (public.is_project_staff(project_id) or (client_visible and public.is_project_client(project_id)));
create policy milestones_write on public.project_milestones for all to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));

create policy deliverables_select on public.deliverables for select to authenticated
  using (public.is_project_staff(project_id) or (client_visible and public.is_project_client(project_id)));
create policy deliverables_insert on public.deliverables for insert to authenticated
  with check (public.is_manager(organization_id));
create policy deliverables_update on public.deliverables for update to authenticated
  using (public.is_project_staff(project_id)) with check (public.is_project_staff(project_id));
create policy deliverables_delete on public.deliverables for delete to authenticated
  using (public.is_manager(organization_id));

create policy tasks_select on public.tasks for select to authenticated
  using (public.is_project_staff(project_id) or (assigned_to = auth.uid() and public.is_staff(organization_id)));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_project_staff(project_id));
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_project_staff(project_id) or assigned_to = auth.uid())
  with check (public.is_project_staff(project_id) or assigned_to = auth.uid());
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_manager(organization_id));

create policy task_comments_select on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and t.organization_id = task_comments.organization_id));
create policy task_comments_delete on public.task_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_manager(organization_id));

-- ── Files ───────────────────────────────────────────────────────────────
create or replace function public.can_view_file(f public.files)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    public.is_manager(f.organization_id)
    or f.uploaded_by = auth.uid()
    or (f.project_id is not null and public.is_project_staff(f.project_id))
    or (f.client_visible and public.portal_client_id(f.organization_id) is not null and (
          (f.project_id is not null and public.is_project_client(f.project_id))
          or (f.project_id is null and f.client_id = public.portal_client_id(f.organization_id))))
$$;

create policy files_select on public.files for select to authenticated
  using (public.can_view_file(files));
create policy files_insert on public.files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_staff(organization_id)
              and (project_id is null or public.is_project_staff(project_id))
              and (project_id is not null or public.is_manager(organization_id)));
create policy files_update on public.files for update to authenticated
  using (public.is_manager(organization_id) or (uploaded_by = auth.uid() and public.is_staff(organization_id)))
  with check (public.is_staff(organization_id));
create policy files_delete on public.files for delete to authenticated
  using (public.is_manager(organization_id));

-- ── Approvals & revisions (written only via client_review_deliverable) ──
create policy approvals_select on public.approvals for select to authenticated
  using (exists (select 1 from public.deliverables d where d.id = deliverable_id));
create policy revisions_select on public.revisions for select to authenticated
  using (exists (select 1 from public.deliverables d where d.id = deliverable_id));
create policy revisions_resolve on public.revisions for update to authenticated
  using (exists (select 1 from public.deliverables d where d.id = deliverable_id and public.is_project_staff(d.project_id)))
  with check (public.is_staff(organization_id));

-- ── Finance ─────────────────────────────────────────────────────────────
create policy quotations_select on public.quotations for select to authenticated
  using (public.is_manager(organization_id)
         or (status <> 'draft' and client_id = public.portal_client_id(organization_id)));
create policy quotations_insert on public.quotations for insert to authenticated
  with check (public.is_manager(organization_id));
create policy quotations_update on public.quotations for update to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));
create policy quotations_delete on public.quotations for delete to authenticated
  using (public.is_admin(organization_id) or (public.is_manager(organization_id) and status = 'draft'));

create policy quotation_items_select on public.quotation_items for select to authenticated
  using (exists (select 1 from public.quotations q where q.id = quotation_id));
create policy quotation_items_write on public.quotation_items for all to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));

create policy agreements_select on public.agreements for select to authenticated
  using (public.is_manager(organization_id)
         or (client_visible and status <> 'draft' and client_id = public.portal_client_id(organization_id)));
create policy agreements_write on public.agreements for all to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));

create policy invoices_select on public.invoices for select to authenticated
  using (public.is_manager(organization_id)
         or (status <> 'draft' and client_id = public.portal_client_id(organization_id)));
create policy invoices_insert on public.invoices for insert to authenticated
  with check (public.is_manager(organization_id));
create policy invoices_update on public.invoices for update to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));
create policy invoices_delete on public.invoices for delete to authenticated
  using (public.is_admin(organization_id) and status in ('draft', 'cancelled'));

create policy invoice_items_select on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy invoice_items_write on public.invoice_items for all to authenticated
  using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));

create policy payments_select on public.payments for select to authenticated
  using (public.is_manager(organization_id) or client_id = public.portal_client_id(organization_id));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.is_manager(organization_id) and recorded_by = auth.uid());
create policy payments_update on public.payments for update to authenticated
  using (public.is_admin(organization_id)) with check (public.is_admin(organization_id));
create policy payments_delete on public.payments for delete to authenticated
  using (public.is_admin(organization_id));

-- ── Notifications & activity ────────────────────────────────────────────
create policy notifications_own_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy deliveries_admin_select on public.notification_deliveries for select to authenticated
  using (public.is_admin(organization_id));

create policy activity_select on public.activity_logs for select to authenticated
  using (public.is_manager(organization_id)
         or actor_id = auth.uid()
         or (project_id is not null and public.is_project_staff(project_id))
         or (client_visible and client_id = public.portal_client_id(organization_id)
             and (project_id is null or public.is_project_client(project_id))));
-- inserts go through public.log_activity() / triggers only

-- anon never touches business data
revoke all on all tables in schema public from anon;
