# Avora Brands
**One Workspace. Every Client. Every Project.** — the operating system of Avora Brands.

Leads → clients → projects → course-wise deliverables → client approvals → quotations → invoices → payments, with a separate client portal.

| | |
|---|---|
| Stack | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Recharts · Supabase (Postgres, Auth, Storage, RLS) |
| Roles | Admin/Owner · Manager · Team member · Client (portal) |
| Security | Every permission enforced in Postgres RLS **and** re-checked in server actions. Clients only see rows tied to their own client and explicitly shared. |

## Quick start (local)
```bash
npm install
cp .env.example .env.local        # fill in Supabase URL + keys
# run supabase/migrations/*.sql in order in the Supabase SQL editor
npm run seed                      # test org, 5 test users, sample data
npm run dev
```
Then sign in at http://localhost:3000 with the test accounts in [docs/SETUP.md](docs/SETUP.md).

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run test:db` | Runs all migrations in PGlite (real Postgres 17) and checks 75 RLS / trigger / RPC rules across every role |
| `npm run seed` | Sample data for local/staging (`-- --reset` to start over) |
| `node --env-file=.env.local scripts/create-admin.mjs you@x.com "Name"` | Production bootstrap: org + first admin, no demo data |

## Docs
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — folder structure, data model, auth & RLS strategy, module map
- [docs/SUPABASE.md](docs/SUPABASE.md) — project setup, migrations, storage, auth emails, cron
- [docs/SETUP.md](docs/SETUP.md) — local setup, test credentials, adding users & clients, deployment to Vercel
- [docs/STATUS.md](docs/STATUS.md) — what's built, what's verified, known gaps and next phases
