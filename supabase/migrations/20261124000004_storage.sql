-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0004 private file storage
-- Object path convention: {organization_id}/{client_id|_}/{project_id|_}/{uuid}-{filename}
-- Reading an object requires being able to read its public.files row, so the
-- file-level RLS (client_visible, project membership …) governs downloads.
-- ════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-files', 'crm-files', false, 52428800)
on conflict (id) do update set public = false;

create policy "crm files: read via files metadata" on storage.objects for select to authenticated
  using (bucket_id = 'crm-files'
         and exists (select 1 from public.files f where f.storage_path = storage.objects.name));

create policy "crm files: staff upload into own org" on storage.objects for insert to authenticated
  with check (bucket_id = 'crm-files'
              and public.is_staff(((storage.foldername(name))[1])::uuid));

create policy "crm files: managers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'crm-files'
         and public.is_manager(((storage.foldername(name))[1])::uuid));
-- No update policy: files are immutable; a change is uploaded as a new version.
