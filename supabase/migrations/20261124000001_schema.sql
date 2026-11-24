-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0001 core schema
-- Multi-tenant: every business row carries organization_id. Access is decided
-- by organization_members.role (+ client_id for portal users) through RLS.
-- ════════════════════════════════════════════════════════════════════════

-- ── Enums ───────────────────────────────────────────────────────────────
create type public.app_role as enum ('admin', 'manager', 'team_member', 'client');
create type public.member_status as enum ('active', 'invited', 'inactive');
create type public.lead_status as enum ('new', 'contacted', 'discussion', 'requirement_received', 'quotation_sent', 'negotiation', 'won', 'lost');
create type public.opportunity_stage as enum ('new', 'discussion', 'quotation_sent', 'negotiation', 'won', 'lost');
create type public.client_status as enum ('active', 'inactive', 'on_hold');
create type public.project_category as enum ('brand_identity', 'graphic_design', 'ui_ux', 'website', 'social_media', 'digital_marketing', 'print', 'custom');
create type public.project_status as enum ('not_started', 'in_progress', 'internal_review', 'client_review', 'revision_required', 'approved', 'completed', 'on_hold', 'cancelled');
create type public.priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_status as enum ('todo', 'in_progress', 'internal_review', 'client_review', 'revision', 'approved', 'completed');
create type public.design_status as enum ('not_started', 'in_progress', 'completed');
create type public.review_status as enum ('not_started', 'pending', 'approved', 'changes_requested');
create type public.approval_status as enum ('pending', 'approved', 'revision_requested');
create type public.milestone_status as enum ('pending', 'in_progress', 'completed');
create type public.quotation_status as enum ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired');
create type public.invoice_status as enum ('draft', 'unpaid', 'partially_paid', 'paid', 'cancelled');
create type public.tax_mode as enum ('intra_state', 'inter_state', 'none');
create type public.payment_method as enum ('bank_transfer', 'upi', 'cash', 'cheque', 'card', 'other');
create type public.payment_type as enum ('advance', 'milestone', 'partial', 'final');
create type public.agreement_status as enum ('draft', 'sent', 'signed', 'expired', 'terminated');
create type public.file_category as enum ('document', 'image', 'design', 'agreement', 'invoice', 'quotation', 'deliverable', 'other');

-- ── Tenancy & identity ──────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "users" table: one profile per auth.users row (auth itself stays in auth schema).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- clients is referenced by organization_members, so create it first.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  company_name text not null check (length(trim(company_name)) > 0),
  contact_person text,
  phone text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  billing_address text,
  state text,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  website text,
  category text,
  status public.client_status not null default 'active',
  account_manager_id uuid references public.profiles (id) on delete set null,
  notes text,
  lead_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  client_id uuid references public.clients (id) on delete cascade,
  employee_code text,
  department text,
  designation text,
  joining_date date,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, employee_code),
  -- portal users must be tied to exactly one client; staff must not be
  constraint member_client_link check ((role = 'client') = (client_id is not null))
);

create table public.company_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  company_name text not null default 'Avora Brands',
  legal_name text,
  tagline text default 'One Workspace. Every Client. Every Project.',
  address text,
  state text,
  gstin text,
  pan text,
  email text,
  phone text,
  website text,
  logo_path text,
  currency text not null default 'INR',
  -- configurable tax slabs, e.g. [{"label":"GST 18%","rate":18}]
  tax_rates jsonb not null default '[{"label":"No tax","rate":0},{"label":"GST 5%","rate":5},{"label":"GST 12%","rate":12},{"label":"GST 18%","rate":18},{"label":"GST 28%","rate":28}]'::jsonb,
  default_tax_rate numeric(5,2) not null default 18 check (default_tax_rate between 0 and 100),
  quotation_prefix text not null default 'QT',
  invoice_prefix text not null default 'INV',
  receipt_prefix text not null default 'RCPT',
  default_payment_terms text default '50% advance, 50% on delivery.',
  default_terms text,
  bank_details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.number_sequences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  period text not null default '',
  last_value integer not null default 0,
  primary key (organization_id, kind, period)
);

-- ── Sales ───────────────────────────────────────────────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  company_name text not null check (length(trim(company_name)) > 0),
  contact_person text,
  phone text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  location text,
  services text[] not null default '{}',
  source text,
  estimated_budget numeric(14,2) check (estimated_budget is null or estimated_budget >= 0),
  assigned_to uuid references public.profiles (id) on delete set null,
  status public.lead_status not null default 'new',
  next_follow_up date,
  notes text,
  lost_reason text,
  converted_client_id uuid references public.clients (id) on delete set null,
  converted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
alter table public.clients add constraint clients_lead_fk foreign key (lead_id) references public.leads (id) on delete set null;

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null default 'note' check (type in ('note', 'call', 'email', 'meeting', 'follow_up', 'status_change')),
  content text not null,
  follow_up_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  name text not null,
  designation text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id is not null or lead_id is not null)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  lead_id uuid references public.leads (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  value numeric(14,2) not null default 0 check (value >= 0),
  stage public.opportunity_stage not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  next_follow_up date,
  expected_close_date date,
  position double precision not null default 0,
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or client_id is not null)
);

-- ── Delivery ────────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null check (length(trim(name)) > 0),
  client_id uuid not null references public.clients (id) on delete restrict,
  category public.project_category not null default 'custom',
  description text,
  start_date date,
  due_date date,
  budget numeric(14,2) check (budget is null or budget >= 0),
  manager_id uuid references public.profiles (id) on delete set null,
  priority public.priority not null default 'medium',
  status public.project_status not null default 'not_started',
  progress smallint not null default 0 check (progress between 0 and 100),
  progress_mode text not null default 'auto' check (progress_mode in ('auto', 'manual')),
  client_visible boolean not null default true,
  lead_id uuid references public.leads (id) on delete set null,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (due_date is null or start_date is null or due_date >= start_date)
);

-- Internal-only financials, isolated in their own table so RLS can hide
-- profitability from managers/team/clients without column-level tricks.
create table public.project_financials (
  project_id uuid primary key references public.projects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  estimated_cost numeric(14,2) not null default 0 check (estimated_cost >= 0),
  actual_cost numeric(14,2) not null default 0 check (actual_cost >= 0),
  notes text,
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role_label text default 'Designer',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  amount numeric(14,2) check (amount is null or amount >= 0),
  status public.milestone_status not null default 'pending',
  client_visible boolean not null default true,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  position integer not null default 0,
  content_received boolean not null default false,
  content_received_at date,
  design_status public.design_status not null default 'not_started',
  assigned_to uuid references public.profiles (id) on delete set null,
  internal_review_status public.review_status not null default 'not_started',
  client_review_status public.review_status not null default 'not_started',
  approval_status public.approval_status not null default 'pending',
  revision_count integer not null default 0 check (revision_count >= 0),
  submitted_at date,
  final_delivered_at date,
  approved_at timestamptz,
  current_file_id uuid,
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  deliverable_id uuid references public.deliverables (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text,
  assigned_to uuid references public.profiles (id) on delete set null,
  priority public.priority not null default 'medium',
  start_date date,
  due_date date,
  status public.task_status not null default 'todo',
  position double precision not null default 0,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

-- ── Files (metadata; bytes live in the private "crm-files" storage bucket) ─
create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  deliverable_id uuid references public.deliverables (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  folder text not null default 'General',
  name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  category public.file_category not null default 'document',
  version integer not null default 1 check (version >= 1),
  -- first upload of a file is its own root; new versions point at the root
  root_file_id uuid references public.files (id) on delete cascade,
  is_latest boolean not null default true,
  client_visible boolean not null default false,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.deliverables add constraint deliverables_current_file_fk foreign key (current_file_id) references public.files (id) on delete set null;

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  file_id uuid references public.files (id) on delete set null,
  file_version integer,
  decision public.approval_status not null check (decision in ('approved', 'revision_requested')),
  comment text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz not null default now()
);

create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  approval_id uuid references public.approvals (id) on delete set null,
  revision_number integer not null,
  notes text,
  requested_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (deliverable_id, revision_number)
);

-- ── Finance ─────────────────────────────────────────────────────────────
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number text not null,
  client_id uuid references public.clients (id) on delete restrict,
  lead_id uuid references public.leads (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  description text,
  issue_date date not null default current_date,
  valid_until date,
  status public.quotation_status not null default 'draft',
  tax_mode public.tax_mode not null default 'intra_state',
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  payment_terms text,
  terms text,
  notes text,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  client_response_note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number),
  check (client_id is not null or lead_id is not null),
  check (valid_until is null or valid_until >= issue_date)
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  line_subtotal numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  line_discount numeric(14,2) generated always as (round(quantity * unit_price * discount_pct / 100, 2)) stored,
  line_tax numeric(14,2) generated always as (round(quantity * unit_price * (1 - discount_pct / 100) * tax_rate / 100, 2)) stored,
  line_total numeric(14,2) generated always as (round(quantity * unit_price * (1 - discount_pct / 100) * (1 + tax_rate / 100), 2)) stored
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  status public.agreement_status not null default 'draft',
  start_date date,
  end_date date,
  signed_date date,
  file_id uuid references public.files (id) on delete set null,
  client_visible boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number text not null,
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  milestone_id uuid references public.project_milestones (id) on delete set null,
  invoice_date date not null default current_date,
  due_date date not null default (current_date + 15),
  status public.invoice_status not null default 'draft',
  tax_mode public.tax_mode not null default 'intra_state',
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) generated always as (total - amount_paid) stored,
  notes text,
  terms text,
  issued_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number),
  check (due_date >= invoice_date)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  description text,
  hsn_sac text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  line_subtotal numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  line_discount numeric(14,2) generated always as (round(quantity * unit_price * discount_pct / 100, 2)) stored,
  line_tax numeric(14,2) generated always as (round(quantity * unit_price * (1 - discount_pct / 100) * tax_rate / 100, 2)) stored,
  line_total numeric(14,2) generated always as (round(quantity * unit_price * (1 - discount_pct / 100) * (1 + tax_rate / 100), 2)) stored
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  receipt_number text not null,
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete restrict,
  payment_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'bank_transfer',
  payment_type public.payment_type not null default 'partial',
  transaction_id text,
  reference_number text,
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, receipt_number)
);

-- ── Notifications & audit ───────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Outbox for future email / WhatsApp delivery. Rows stay 'pending' (or
-- 'skipped') until a dispatcher with real credentials processes them —
-- nothing here claims a message was sent.
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  client_id uuid references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────
create index on public.organization_members (user_id);
create index on public.organization_members (organization_id, role);
create index on public.clients (organization_id, status);
create index on public.clients (account_manager_id);
create index on public.leads (organization_id, status);
create index on public.leads (assigned_to);
create index on public.leads (organization_id, next_follow_up);
create index on public.lead_activities (lead_id, created_at desc);
create index on public.contacts (client_id);
create index on public.opportunities (organization_id, stage, position);
create index on public.projects (organization_id, status);
create index on public.projects (client_id);
create index on public.projects (manager_id);
create index on public.project_members (user_id);
create index on public.project_milestones (project_id, position);
create index on public.deliverables (project_id, position);
create index on public.deliverables (assigned_to);
create index on public.tasks (project_id, status);
create index on public.tasks (assigned_to, status);
create index on public.tasks (organization_id, due_date);
create index on public.task_comments (task_id, created_at);
create index on public.files (project_id);
create index on public.files (client_id);
create index on public.files (deliverable_id);
create index on public.files (root_file_id);
create index on public.approvals (deliverable_id, decided_at desc);
create index on public.revisions (deliverable_id);
create index on public.quotations (organization_id, status);
create index on public.quotations (client_id);
create index on public.quotation_items (quotation_id, position);
create index on public.agreements (client_id);
create index on public.invoices (organization_id, status, due_date);
create index on public.invoices (client_id);
create index on public.invoices (project_id);
create index on public.invoice_items (invoice_id, position);
create index on public.payments (organization_id, payment_date);
create index on public.payments (invoice_id);
create index on public.payments (client_id);
create index on public.notifications (user_id, read_at, created_at desc);
create index on public.activity_logs (organization_id, created_at desc);
create index on public.activity_logs (entity_type, entity_id);
create index on public.activity_logs (project_id, created_at desc);
create index on public.activity_logs (client_id, created_at desc);
