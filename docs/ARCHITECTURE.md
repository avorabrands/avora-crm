# Architecture

## Folder structure
```
supabase/migrations/        0001 schema · 0002 functions & triggers · 0003 RLS · 0004 storage
scripts/                    seed.mjs · create-admin.mjs · db-test/ (PGlite RLS test-suite)
src/
  proxy.ts                  session refresh + optimistic auth redirect (Next 16 "middleware")
  app/
    (auth)/                 login · forgot-password · reset-password
    (internal)/             staff CRM — layout enforces staff role
      dashboard leads clients pipeline projects tasks files
      quotations agreements invoices payments team reports settings
    portal/                 client portal — layout enforces client role
    print/                  chrome-free quotation / invoice / receipt (Print → Save as PDF)
    api/files/[id]          signed-URL download (RLS-checked)
    api/reports/[report]    CSV export
    api/cron/reminders      daily reminder job (Vercel Cron)
  features/<module>/        schema.ts (zod) · actions.ts (server actions) · queries.ts · components
  components/ui             shadcn (Base UI) primitives
  components/app            design-system pieces: Panel, StatCard, StatusBadge, FormDialog,
                            ConfirmAction, TableToolbar, SortHeader, Pagination, KanbanBoard, TabNav…
  components/shell          sidebar, mobile nav, global search (⌘K), notifications, user menu
  lib/                      supabase clients, auth/session (DAL), permissions, constants, tax, format
```

## Request flow
1. `proxy.ts` refreshes the Supabase session cookie; unauthenticated → `/login`.
2. Layouts call `requireStaff()` / `requireClient()` (verified JWT claims + active membership). Clients hitting CRM URLs are sent to `/portal` and vice versa.
3. Pages query Supabase **as the user** — RLS filters rows.
4. Mutations are server actions: `authorize(capability)` → zod validation → Supabase (RLS again) → `logActivity` → `revalidatePath`.
5. The service-role key is used only in `lib/supabase/admin.ts` (server-only) for inviting users and cron.

Cache Components is disabled deliberately: every screen is private per-user data.

## Data model (key tables)
| Area | Tables |
|---|---|
| Tenancy | `organizations`, `profiles` (= users), `organization_members` (role, client_id for portal users), `company_settings`, `number_sequences` |
| Sales | `leads`, `lead_activities`, `contacts`, `opportunities` |
| Delivery | `clients`, `projects`, `project_financials` (admin-only costs), `project_members`, `project_milestones`, `deliverables`, `tasks`, `task_comments` |
| Review | `files` (versions via `root_file_id`), `approvals`, `revisions` |
| Finance | `quotations`, `quotation_items`, `agreements`, `invoices`, `invoice_items`, `payments` |
| Comms | `notifications`, `notification_deliveries` (outbox for email/WhatsApp), `activity_logs` |

Database-maintained values (no hard-coded figures):
- Document numbers `LD-0001`, `CL-0001`, `PR-0001`, `QT-2026-0001`, `INV-2026-0001`, `RCPT-2026-0001` (prefixes configurable)
- Line amounts are generated columns; document totals, `amount_paid`, `balance_due` and invoice status are kept up to date by triggers
- Over-payment, wrong-client payments and payments on draft invoices are rejected in the DB
- Project progress = approved deliverables ÷ total (or completed tasks ÷ total) unless set to manual
- "Overdue" is derived from due date, never stored

## Role matrix
| | Admin | Manager | Team member | Client |
|---|---|---|---|---|
| Leads / pipeline | ✔ | ✔ | assigned leads only | — |
| Clients | ✔ (+delete) | ✔ | read | own profile via `portal_me()` only |
| Projects | ✔ (+delete) | ✔ | projects they manage / are members of | own, `client_visible` only |
| Deliverables | ✔ | ✔ | update workflow on own projects | shared ones; approve / revise via RPC |
| Tasks & comments | ✔ | ✔ | own projects; can move up to *Internal review* | never |
| Quotations / invoices / payments | ✔ | ✔ (no deletes of issued docs) | — | own, non-draft |
| Profitability | ✔ | — | — | — |
| Team, settings, user invites | ✔ | view team | — | — |

Client portal writes are only possible through `SECURITY DEFINER` RPCs (`client_review_deliverable`, `client_respond_quotation`, `client_mark_quotation_viewed`), which validate ownership themselves.

## Course-wise deliverable tracking
A project can have any number of deliverables (e.g. 34 course brochures). Each tracks content received, design status, designer, internal review, client review, revision count, approval (+timestamp), submission and final delivery dates and the current file version. The tracker supports filtering by stage, multi-select bulk updates, bulk upload (files matched to deliverables by name) and "Send to client", which shares the current file and opens it for review in the portal.
