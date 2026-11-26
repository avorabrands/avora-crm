# Supabase configuration

## 1. Create the project
Create a project at supabase.com (region close to India, e.g. Mumbai `ap-south-1`).
From **Project Settings → API** copy the URL, `anon` key and `service_role` key into `.env.local` (see `.env.example`).

## 2. Run migrations
In **SQL Editor**, run each file in `supabase/migrations/` **in filename order**:
1. `…0001_schema.sql` – enums, tables, constraints, indexes
2. `…0002_functions.sql` – helper functions, numbering, totals, progress, notifications, portal RPCs
3. `…0003_rls.sql` – Row Level Security for every table
4. `…0004_storage.sql` – private `crm-files` bucket + storage policies
5. `…0005_harden_function_grants.sql` – least-privilege EXECUTE (signed-out users can call nothing)
6. `…0006_project_policy_and_convert_rpc.sql` – projects read policy fix + atomic `convert_lead()`
7. `…0007_storage_orphan_cleanup.sql` – uploaders can remove their own orphaned objects
8. `…0008_column_guards.sql` – team members can't approve/complete/share via direct API calls
9. `…0009_atomic_document_save.sql` – quotations/invoices save header + line items in one transaction
10. `…0010_document_templates.sql` – per-document PDF template (classic / modern / professional) + defaults in company settings
11. `…0011_standard_template.sql` – adds the fourth template, "standard" (bordered tax invoice with per-line GST columns)
12. `…0012_lead_role.sql` – new membership role `lead`
13. `…0013_lead_logins.sql` – lead sign-ins see only their sent quotations (view / accept / decline); converting the lead turns the login into a client login

(With the Supabase CLI: `supabase link` then `supabase db push`.)

Verify locally any time with `npm run test:db` (no Supabase needed).

**Test data:** run `supabase/seed.sql` in the SQL editor (no service-role key needed) or `npm run seed`. Dev/staging only.

The current project is **avora-crm** (`xorfhfhxpfignobisuku`, ap-south-1); migrations 0001–0013 are applied (demo data removed).

## 3. Auth settings
- **Authentication → Providers → Email**: enable email/password. Disable public sign-ups (**"Allow new users to sign up" → off**) — users are invited by an admin.
- **Authentication → URL Configuration**: Site URL = your app URL; add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs.
- **SMTP**: configure a custom SMTP sender for production; Supabase's default mailer is rate-limited and meant for testing. Invites and password resets are sent by Supabase Auth.

## 4. Storage
Migration 0004 creates the private bucket `crm-files` (50 MB/file). Objects are stored as
`{org}/{client|_}/{project|_}/{uuid}-{name}`. Downloads go through `/api/files/:id`, which issues a 5-minute signed URL only if the user can read the file's metadata row.

## 5. Reminders (follow-ups, deadlines, overdue)
`public.generate_due_reminders()` creates in-app notifications and expires stale quotations. Schedule it either:
- **Vercel Cron** (included in `vercel.json`, daily 09:00 IST): set `CRON_SECRET` in Vercel env; or
- **pg_cron** in Supabase:
  ```sql
  create extension if not exists pg_cron;
  select cron.schedule('avora-reminders', '30 3 * * *', $$select public.generate_due_reminders()$$);
  ```

## 6. Generated types (optional)
`npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts` and pass the type to the clients for stricter typing.

## Email / WhatsApp
Not integrated in v1. Notifications are in-app; `notification_deliveries` is the outbox a future dispatcher would process. The UI never claims an email was sent.
