-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0005 least-privilege EXECUTE grants (Supabase security advisor)
-- • anon (signed-out) can execute nothing in public
-- • authenticated keeps only: RLS access helpers (policies call them as the
--   user) and the RPCs the app calls. Trigger/refresh/numbering functions are
--   internal — triggers run regardless of the caller's EXECUTE privilege.
-- ════════════════════════════════════════════════════════════════════════
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

grant execute on function
  public.member_role(uuid), public.has_role(uuid, public.app_role[]), public.is_staff(uuid), public.is_manager(uuid),
  public.is_admin(uuid), public.portal_client_id(uuid), public.is_project_staff(uuid), public.is_project_client(uuid),
  public.can_view_project(uuid), public.shares_org_with(uuid), public.can_view_file(public.files),
  public.portal_me(), public.log_activity(uuid, text, uuid, text, text, jsonb, uuid, uuid, boolean),
  public.client_review_deliverable(uuid, public.approval_status, text),
  public.client_mark_quotation_viewed(uuid), public.client_respond_quotation(uuid, boolean, text)
to authenticated;

-- the cron job runs as service_role
grant execute on function public.generate_due_reminders() to service_role;

-- plain trigger helpers: pin search_path (advisor: function_search_path_mutable)
alter function public.set_updated_at() set search_path = '';
alter function public.trg_task_completed_at() set search_path = '';
alter function public.trg_deliverable_approved_at() set search_path = '';
