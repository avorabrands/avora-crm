# Setup, test accounts & deployment

## Local development
1. `npm install`
2. Configure Supabase (docs/SUPABASE.md) and create `.env.local` from `.env.example`.
3. `npm run seed` — creates the **Avora Brands** org with sample leads, clients, two projects (one with 34 course deliverables at different stages), quotations, invoices and payments.
4. `npm run dev` → http://localhost:3000

### Test credentials (local / staging only)
All seeded accounts share the password in `scripts/seed.mjs` (`SEED_PASSWORD` overrides it):

| Role | Email | Sees |
|---|---|---|
| Admin / Owner | admin@avora.test | everything incl. profitability, team, settings |
| Manager | manager@avora.test | sales, clients, projects, finance |
| Team member | designer@avora.test | Course Creative Design + Bloom projects, own tasks |
| Team member | designer2@avora.test | Course Creative Design, assigned lead |
| Client (LumiEdu) | client@lumiedu.test | portal: LumiEdu's shared projects, approvals, invoices |

Never run the seed against production.

## Adding people
**Employees** — Admin → *Team* → *Add employee*. An invite email is sent via Supabase; they set a password via the link. Change role/department or deactivate from the same table. Requires `SUPABASE_SERVICE_ROLE_KEY` on the server.

**Clients** — *Clients* → *Add client* (or convert a won lead from the lead page). On the client's Overview tab, an admin uses *Invite to portal* to give a client contact access. Revoke there at any time.

**What clients see** — only projects with "Show in client portal" on, deliverables after *Send to client*, files marked *Shared*, milestones marked visible, and quotations/invoices once sent/issued. Internal notes, task comments, team data and costs are never exposed.

## Production bootstrap
```bash
node --env-file=.env.local scripts/create-admin.mjs owner@avorabrands.com "Owner Name"
```
Then sign in, fill **Settings → Company** and **Billing & GST**, and invite the team.

## Deploy to Vercel
1. Push to GitHub and import the repo in Vercel (root directory: `avora-crm` if the repo root is the parent folder).
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (your domain), `CRON_SECRET`.
3. Add `https://<domain>/auth/callback` to Supabase redirect URLs.
4. Deploy. `vercel.json` registers the daily reminders cron.
