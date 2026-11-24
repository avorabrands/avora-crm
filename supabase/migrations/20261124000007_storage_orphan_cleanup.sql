-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0007 let an uploader clean up their own ORPHANED objects
-- (bytes uploaded but no public.files row, e.g. the metadata insert failed).
-- Objects that have a metadata row stay governed by the files policies.
-- ════════════════════════════════════════════════════════════════════════
create policy "crm files: uploader reads own orphans" on storage.objects for select to authenticated
  using (bucket_id = 'crm-files' and owner_id = auth.uid()::text
         and not exists (select 1 from public.files f where f.storage_path = storage.objects.name));

create policy "crm files: uploader deletes own orphans" on storage.objects for delete to authenticated
  using (bucket_id = 'crm-files' and owner_id = auth.uid()::text
         and not exists (select 1 from public.files f where f.storage_path = storage.objects.name));
