# Build status

## Implemented (functional, database-backed)
- Auth (email/password, invite, reset), role-aware routing, RLS on all 29 tables, private storage
- Dashboard with live KPIs, revenue / project-status / pipeline charts, deadlines, tasks, reminders, enquiries, activity
- Leads: table + drag-and-drop board, filters, follow-up timeline, conversion to client (+ project)
- Clients: list with revenue/outstanding, profile tabs (overview, projects, quotations, agreements, invoices, payments, files, activity), portal access management
- Sales pipeline: deal board with drag-and-drop, validation, forecast, activity logging
- Projects: workspace with 11 tabs, team, milestones, admin-only profitability
- Course-wise deliverables tracker with bulk updates, bulk upload by file name, send-to-client, offline decision recording, revision history
- Tasks: list / board / calendar, comments, attachments, team-member status limits
- Quotations (GST slabs, CGST/SGST vs IGST, duplicate, accept, convert to invoice), invoices (issue/cancel, HSN/SAC), payments (advance/milestone/partial/final, receipts), agreements with uploads
- Printable quotation / invoice / receipt pages (browser *Save as PDF*)
- Files with folders, versions, sharing, previews; reports (9) with filters + CSV; team workload; settings
- Client portal: dashboard, projects, deliverables, approvals (approve / request revision with version history), files, quotations (accept/decline), invoices, payments, profile
- In-app notifications via DB triggers + daily reminder job

## Verified
- `npm run test:db`: 75 checks pass — migrations apply on Postgres 17 and RLS isolates every role (including client-vs-client), plus totals, GST math, over-payment guards, approvals, storage access and reminder idempotency.
- `tsc --noEmit`, `eslint`, `next build` all pass; `/setup` and `/login` render.

## Verified live on Supabase (project avora-crm, ap-south-1)
- Migrations 0001–0008 applied; security advisor: no signed-out access to any function; remaining notices are intentional (RLS helpers, client RPCs, internal `number_sequences`).
- Seeded via `supabase/seed.sql`; DB-computed totals checked by hand (₹1,00,300 quotation; ₹82,600 invoice with IGST; 26% → 29% progress).
- Admin: all 63 internal pages load; CSV export; lead create (validation keeps input) → convert to client + project in one transaction.
- Deliverables: bulk upload to Supabase Storage with name matching → send to client → client previews PDF via signed URL → requests revision (comment required) / approves; manager + designer notified; progress recalculated.
- Client: all portal pages load; another client's quotation returns 404; reports API 403; internal pages redirect.
- Team member: sees only assigned projects/tasks, finance/pipeline/team/reports blocked, task status limited in UI **and** database.
- Manager: overpayment rejected (field error), partial payment updates balance and keeps "Overdue".

## Bugs found and fixed during live testing
- Projects couldn't be created through the API (read policy couldn't see the row being inserted) → policy rewritten; regression tests added.
- Lead conversion could leave partial data → now a single `convert_lead()` transaction.
- React 19 reset forms after failed validation → forms no longer clear user input.
- Bulk upload matched "D.Pharm" to unrelated files and could reopen approved work → whole-word matching, approved items skipped.
- File delete left bytes in Storage → delete order fixed; orphan-cleanup policy added.
- Team members could approve/complete via direct API → column guard triggers.
- Sign-out menu item did nothing; list/board view switch crashed /leads and /tasks; portal Approvals crashed → fixed.
- Labels weren't linked to inputs (screen readers) → fixed.

## Still not verified
- Invite emails (needs `SUPABASE_SERVICE_ROLE_KEY` + SMTP), reminders cron, drag-and-drop by mouse (status changes verified via the same server actions), dark mode visual pass, mobile pass beyond the dashboard.

## Known limitations / next phases
- PDF is via the browser print dialog, not a server-generated file; quotations aren't emailed (no email provider configured).
- Email/WhatsApp delivery, payment gateway — architecture ready, not integrated.
- Supabase-generated TS types not wired (rows are loosely typed); add after linking a project.
- Single organisation assumed in the UI (schema is multi-tenant).
