// Runs all migrations in PGlite (Postgres 17 in WASM) and exercises the RLS
// policies, triggers and RPCs as each role. Usage: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const db = new PGlite();

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log("  ✓", name); }
  else { failed++; console.log("  ✗", name, detail ?? ""); }
}

process.on("unhandledRejection", (e) => { console.error("\nUNCAUGHT:", e.message, e.where ?? "", e.query ?? ""); process.exit(1); });
await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
// Supabase's default privileges: new tables/functions in public are granted to API roles
await db.exec(`
  alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
const migDir = join(root, "supabase", "migrations");
for (const f of readdirSync(migDir).sort()) {
  try { await db.exec(readFileSync(join(migDir, f), "utf8")); console.log("migrated", f); }
  catch (e) { console.error("MIGRATION FAILED", f, e.message); process.exit(1); }
}
await db.exec(`grant select, insert, update, delete on storage.objects to authenticated;`);

// ── fixtures (as superuser) ────────────────────────────────────────────
const ids = {};
async function user(key, email) {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, { full_name: key }]);
  ids[key] = r.rows[0].id;
}
for (const [k, e] of [["admin", "a@x.in"], ["manager", "m@x.in"], ["designer", "d@x.in"], ["designer2", "d2@x.in"], ["clientA", "ca@x.in"], ["clientB", "cb@x.in"], ["outsider", "o@x.in"]]) await user(k, e);

const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
ids.org = (await one(`insert into organizations (name, slug) values ('Avora Brands','avora') returning id`)).id;
ids.org2 = (await one(`insert into organizations (name, slug) values ('Other Co','other') returning id`)).id;
await db.query(`insert into company_settings (organization_id) values ($1), ($2)`, [ids.org, ids.org2]);
ids.cA = (await one(`insert into clients (organization_id, company_name, notes) values ($1,'LumiEdu','INTERNAL: tough negotiator') returning id, code`, [ids.org])).id;
ids.cB = (await one(`insert into clients (organization_id, company_name) values ($1,'Other Client') returning id`, [ids.org])).id;
const mem = (u, role, client = null, org = ids.org) =>
  db.query(`insert into organization_members (organization_id, user_id, role, client_id) values ($1,$2,$3,$4)`, [org, ids[u], role, client]);
await mem("admin", "admin"); await mem("manager", "manager"); await mem("designer", "team_member"); await mem("designer2", "team_member");
await mem("clientA", "client", ids.cA); await mem("clientB", "client", ids.cB);
await mem("outsider", "admin", null, ids.org2);

ids.pA = (await one(`insert into projects (organization_id, name, client_id, manager_id) values ($1,'Course Creative Design',$2,$3) returning id`, [ids.org, ids.cA, ids.manager])).id;
ids.pHidden = (await one(`insert into projects (organization_id, name, client_id, client_visible) values ($1,'Internal pitch',$2,false) returning id`, [ids.org, ids.cA])).id;
ids.pB = (await one(`insert into projects (organization_id, name, client_id) values ($1,'Other project',$2) returning id`, [ids.org, ids.cB])).id;
await db.query(`insert into project_members (project_id, user_id, organization_id) values ($1,$2,$3)`, [ids.pA, ids.designer, ids.org]);
await db.query(`insert into project_financials (project_id, organization_id, estimated_cost) values ($1,$2,50000)`, [ids.pA, ids.org]);
for (let i = 1; i <= 4; i++) {
  await db.query(`insert into deliverables (organization_id, project_id, name, position, client_visible) values ($1,$2,$3,$4,$5)`, [ids.org, ids.pA, `Course ${i}`, i, i <= 3]);
}
ids.d1 = (await one(`select id from deliverables where name='Course 1'`)).id;
ids.d4 = (await one(`select id from deliverables where name='Course 4'`)).id;
ids.lead = (await one(`insert into leads (organization_id, company_name, assigned_to) values ($1,'Vydehi',$2) returning id, code`, [ids.org, ids.designer2])).id;
await db.query(`insert into tasks (organization_id, project_id, title, assigned_to) values ($1,$2,'Design brochure',$3)`, [ids.org, ids.pA, ids.designer]);
ids.task = (await one(`select id from tasks limit 1`)).id;
await db.query(`insert into task_comments (organization_id, task_id, author_id, body) values ($1,$2,$3,'internal: client is slow')`, [ids.org, ids.task, ids.designer]);

// ── role switching ─────────────────────────────────────────────────────
async function as(key, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${key ? ids[key] : ""}', false); set role ${key ? "authenticated" : "anon"};`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
}
const count = (sql, p) => db.query(sql, p).then((r) => r.rows.length).catch((e) => `ERR ${e.message}`);
const tryq = (sql, p) => db.query(sql, p).then(() => "ok").catch((e) => e.message);

console.log("\nNumbering & triggers");
check("lead code generated", (await one(`select code from leads where id=$1`, [ids.lead])).code === "LD-0001");
check("client code generated", (await one(`select code from clients where id=$1`, [ids.cA])).code === "CL-0001");
check("profile auto-created from auth.users", (await one(`select count(*)::int n from profiles`)).n === 7);
check("member_client_link constraint", (await tryq(`insert into organization_members (organization_id,user_id,role) values ($1,$2,'client')`, [ids.org2, ids.clientA])).includes("member_client_link"));

console.log("\nAdmin");
await as("admin", async () => {
  check("sees all org clients", (await count(`select * from clients`)) === 2);
  check("sees project financials", (await count(`select * from project_financials`)) === 1);
  check("cannot see other org", (await count(`select * from organizations`)) === 1);
});

console.log("\nManager");
await as("manager", async () => {
  check("sees leads", (await count(`select * from leads`)) === 1);
  check("cannot see profitability", (await count(`select * from project_financials`)) === 0);
  check("can create client", (await tryq(`insert into clients (organization_id, company_name) values ($1,'New Co')`, [ids.org])) === "ok");
  check("cannot delete client", (await count(`delete from clients where company_name='New Co' returning id`)) === 0);
  check("cannot add members", (await tryq(`insert into organization_members (organization_id,user_id,role) values ($1,$2,'manager')`, [ids.org, ids.outsider])).includes("row-level security"));
});

console.log("\nWrites with RETURNING (as the app does them)");
await as("manager", async () => {
  check("manager creates project (insert … returning)", (await tryq(`insert into projects (organization_id, name, client_id, manager_id) values ($1,'Returning probe',$2,$3) returning id, code`, [ids.org, ids.cB, ids.manager])) === "ok");
  check("manager creates task (insert … returning)", (await tryq(`insert into tasks (organization_id, project_id, title) values ($1,$2,'probe') returning id`, [ids.org, ids.pA])) === "ok");
  const conv = await db.query(`select convert_lead($1, 'Vydehi Brochures', 'graphic_design', 50000) r`, [ids.lead]).then((r) => r.rows[0].r).catch((e) => e.message);
  check("convert_lead creates client + project atomically", typeof conv === "object" && conv.project_id, conv);
  const noProj = await db.query(`insert into leads (organization_id, company_name) values ($1,'No-project lead') returning id`, [ids.org]).then((r) => r.rows[0].id);
  check("convert_lead without a project", (await tryq(`select convert_lead($1)`, [noProj])) === "ok");
  check("convert_lead refuses a second conversion", (await tryq(`select convert_lead($1)`, [ids.lead])).includes("already been converted"));
});
await as("designer2", async () => {
  check("team member cannot convert leads", (await tryq(`select convert_lead($1)`, [ids.lead])) !== "ok");
});

console.log("\nTeam member (designer on project A)");
await as("designer", async () => {
  check("sees only assigned project", (await count(`select * from projects`)) === 1);
  check("no leads (none assigned)", (await count(`select * from leads`)) === 0);
  check("no quotations/invoices", (await count(`select * from invoices`)) === 0);
  check("can update own task status", (await count(`update tasks set status='in_progress' where id=$1 returning id`, [ids.task])) === 1);
  check("can update deliverable on own project", (await count(`update deliverables set design_status='in_progress' where id=$1 returning id`, [ids.d1])) === 1);
  check("API: designer cannot complete a task directly", (await tryq(`update tasks set status='completed' where id=$1`, [ids.task])).includes("Only managers"));
  check("API: designer cannot approve a deliverable directly", (await tryq(`update deliverables set approval_status='approved' where id=$1`, [ids.d1])).includes("Only managers"));
  check("API: designer cannot share a deliverable with client", (await tryq(`update deliverables set client_visible=true where id=$1`, [ids.d4])).includes("Only managers"));
  check("designer can still move task to internal review", (await tryq(`update tasks set status='internal_review' where id=$1`, [ids.task])) === "ok");
  check("cannot edit project budget", (await count(`update projects set budget=1 where id=$1 returning id`, [ids.pA])) === 0);
});
await as("designer2", async () => {
  check("designer2 sees assigned lead only", (await count(`select * from leads`)) === 1);
  check("designer2 sees no projects", (await count(`select * from projects`)) === 0);
});

console.log("\nClient A (portal)");
await as("clientA", async () => {
  check("cannot read clients table (internal notes)", (await count(`select * from clients`)) === 0);
  check("portal_me returns own company", (await one(`select company_name from portal_me()`))?.company_name === "LumiEdu");
  check("sees only shared own projects", (await count(`select * from projects`)) === 1);
  check("sees only client-visible deliverables", (await count(`select * from deliverables`)) === 3);
  check("cannot see tasks", (await count(`select * from tasks`)) === 0);
  check("cannot see task comments", (await count(`select * from task_comments`)) === 0);
  check("cannot see leads", (await count(`select * from leads`)) === 0);
  check("cannot see team profiles", (await count(`select * from profiles`)) === 1);
  check("cannot update deliverable directly", (await count(`update deliverables set approval_status='approved' returning id`)) === 0);
  check("cannot review hidden deliverable", (await tryq(`select client_review_deliverable($1,'approved')`, [ids.d4])).includes("access"));
  check("revision needs a comment", (await tryq(`select client_review_deliverable($1,'revision_requested','')`, [ids.d1])).includes("describe"));
  check("can request revision", (await tryq(`select client_review_deliverable($1,'revision_requested','Change logo colour')`, [ids.d1])) === "ok");
});
let d1 = await one(`select revision_count, approval_status from deliverables where id=$1`, [ids.d1]);
check("revision_count incremented", d1.revision_count === 1 && d1.approval_status === "revision_requested");
check("manager notified of feedback", (await one(`select count(*)::int n from notifications where user_id=$1 and type='client_feedback'`, [ids.manager])).n === 1);
await as("clientA", async () => {
  check("can approve", (await tryq(`select client_review_deliverable($1,'approved','Looks great')`, [ids.d1])) === "ok");
  check("sees own activity (client-visible)", (await count(`select * from activity_logs`)) === 2);
});
check("project progress from deliverables (1/4 = 25%)", (await one(`select progress from projects where id=$1`, [ids.pA])).progress === 25);

console.log("\nClient B isolation");
await as("clientB", async () => {
  check("cannot see client A projects", (await count(`select * from projects where client_id=$1`, [ids.cA])) === 0);
  check("cannot review client A deliverable", (await tryq(`select client_review_deliverable($1,'approved')`, [ids.d1])).length > 0);
  check("sees no client A activity", (await count(`select * from activity_logs`)) === 0);
});

console.log("\nFinance: quotations, invoices, payments");
let q, inv;
await as("manager", async () => {
  q = await one(`insert into quotations (organization_id, client_id, title) values ($1,$2,'34 course brochures') returning id, number`, [ids.org, ids.cA]);
  await db.query(`insert into quotation_items (organization_id, quotation_id, name, quantity, unit_price, discount_pct, tax_rate) values ($1,$2,'Course brochure',34,2500,10,18)`, [ids.org, q.id]);
  inv = await one(`insert into invoices (organization_id, client_id, project_id, status) values ($1,$2,$3,'unpaid') returning id, number`, [ids.org, ids.cA, ids.pA]);
  await db.query(`insert into invoice_items (organization_id, invoice_id, name, quantity, unit_price, tax_rate) values ($1,$2,'Advance',1,10000,18)`, [ids.org, inv.id]);
});
const qt = await one(`select number, subtotal, discount_total, tax_total, total from quotations where id=$1`, [q.id]);
check("quotation number", /^QT-\d{4}-0001$/.test(qt.number), qt.number);
check("quotation totals (85000 − 8500 + 13770 = 90270)", Number(qt.total) === 90270 && Number(qt.tax_total) === 13770, qt);
await as("clientA", async () => {
  check("client cannot see draft quotation", (await count(`select * from quotations`)) === 0);
});
await db.query(`update quotations set status='sent' where id=$1`, [q.id]);
await as("clientA", async () => {
  check("client sees sent quotation", (await count(`select * from quotations`)) === 1);
  check("client sees quotation items", (await count(`select * from quotation_items`)) === 1);
  await db.query(`select client_mark_quotation_viewed($1)`, [q.id]);
  check("client accepts quotation", (await tryq(`select client_respond_quotation($1, true, 'Go ahead')`, [q.id])) === "ok");
});
check("quotation accepted + managers notified", (await one(`select count(*)::int n from notifications where type='quotation_accepted'`)).n === 2);
check("invoice total 11800", Number((await one(`select total from invoices where id=$1`, [inv.id])).total) === 11800);
await as("manager", async () => {
  check("partial payment ok", (await tryq(`insert into payments (organization_id, client_id, invoice_id, amount, recorded_by) values ($1,$2,$3,5000,$4)`, [ids.org, ids.cA, inv.id, ids.manager])) === "ok");
  check("overpayment rejected", (await tryq(`insert into payments (organization_id, client_id, invoice_id, amount, recorded_by) values ($1,$2,$3,9000,$4)`, [ids.org, ids.cA, inv.id, ids.manager])).includes("exceeds"));
  check("wrong client rejected", (await tryq(`insert into payments (organization_id, client_id, invoice_id, amount, recorded_by) values ($1,$2,$3,10,$4)`, [ids.org, ids.cB, inv.id, ids.manager])).includes("does not match"));
});
let i1 = await one(`select status, amount_paid, balance_due from invoices where id=$1`, [inv.id]);
check("invoice partially paid", i1.status === "partially_paid" && Number(i1.balance_due) === 6800, i1);
await as("manager", async () => {
  await db.query(`insert into payments (organization_id, client_id, invoice_id, amount, payment_type, recorded_by) values ($1,$2,$3,6800,'final',$4)`, [ids.org, ids.cA, inv.id, ids.manager]);
});
i1 = await one(`select status, balance_due from invoices where id=$1`, [inv.id]);
check("invoice paid", i1.status === "paid" && Number(i1.balance_due) === 0, i1);
check("admin notified of payments", (await one(`select count(*)::int n from notifications where user_id=$1 and type='payment_recorded'`, [ids.admin])).n === 2);
await as("clientB", async () => {
  check("client B sees no client A invoices/payments", (await count(`select * from invoices`)) === 0 && (await count(`select * from payments`)) === 0);
});
await as("designer", async () => {
  check("team member cannot see payments", (await count(`select * from payments`)) === 0);
});

console.log("\nAtomic quotation / invoice saves");
await as("manager", async () => {
  const line = (o = {}) => ({ name: "Brochure", description: "", hsn_sac: "998391", quantity: 2, unit_price: 2500, discount_pct: 0, tax_rate: 18, ...o });
  const before = Number((await one(`select count(*) n from quotations`)).n);
  const qid = await db.query(`select save_quotation(null, $1, $2, $3) id`, [ids.org, { client_id: ids.cA, title: "Atomic test", issue_date: "2026-11-26", tax_mode: "intra_state" }, JSON.stringify([line(), line({ name: "Second" })])]).then((r) => r.rows[0].id).catch((e) => e.message);
  const q = await one(`select total, (select count(*) from quotation_items where quotation_id=$1)::int n from quotations where id=$1`, [qid]).catch(() => null);
  check("save_quotation writes header + items (hsn ignored)", q && Number(q.total) === 11800 && q.n === 2, { qid, q });
  check("bad line rolls back the whole quotation", (await tryq(`select save_quotation(null, $1, $2, $3)`, [ids.org, { client_id: ids.cA, title: "Should not exist", issue_date: "2026-11-26", tax_mode: "intra_state" }, JSON.stringify([line({ quantity: 0 })])])) !== "ok" && Number((await one(`select count(*) n from quotations`)).n) === before + 1);
  check("failed edit keeps existing items", (await tryq(`select save_quotation($1, $2, $3, $4)`, [qid, ids.org, { client_id: ids.cA, title: "Edit", issue_date: "2026-11-26", tax_mode: "intra_state" }, JSON.stringify([line({ unit_price: -1 })])])) !== "ok" && (await one(`select count(*)::int n from quotation_items where quotation_id=$1`, [qid])).n === 2);
  check("edit replaces items", (await tryq(`select save_quotation($1, $2, $3, $4)`, [qid, ids.org, { client_id: ids.cA, title: "Edited", issue_date: "2026-11-26", tax_mode: "none" }, JSON.stringify([line({ quantity: 1 })])])) === "ok" && Number((await one(`select total from quotations where id=$1`, [qid])).total) === 2500);
  const iid = await db.query(`select save_invoice(null, $1, $2, $3) id`, [ids.org, { client_id: ids.cA, invoice_date: "2026-11-26", due_date: "2026-12-10", tax_mode: "inter_state" }, JSON.stringify([line()])]).then((r) => r.rows[0].id).catch((e) => e.message);
  const inv = await one(`select total, (select hsn_sac from invoice_items where invoice_id=$1 limit 1) hsn from invoices where id=$1`, [iid]).catch(() => null);
  check("save_invoice keeps HSN/SAC", inv && Number(inv.total) === 5900 && inv.hsn === "998391", { iid, inv });
});
await as("designer", async () => {
  check("team member can't save quotations", (await tryq(`select save_quotation(null, $1, $2, $3)`, [ids.org, { client_id: ids.cA, title: "x", issue_date: "2026-11-26", tax_mode: "none" }, JSON.stringify([{ name: "a", quantity: 1, unit_price: 1 }])])) !== "ok");
});

console.log("\nFiles & storage");
const path = `${ids.org}/${ids.cA}/${ids.pA}/x-brochure.pdf`;
const hiddenPath = `${ids.org}/${ids.cA}/${ids.pA}/y-internal.pdf`;
await as("designer", async () => {
  check("designer uploads object", (await tryq(`insert into storage.objects (bucket_id, name) values ('crm-files',$1), ('crm-files',$2)`, [path, hiddenPath])) === "ok");
  check("designer inserts file rows", (await tryq(`insert into files (organization_id, client_id, project_id, deliverable_id, name, storage_path, uploaded_by, client_visible) values ($1,$2,$3,$4,'brochure.pdf',$5,$6,true), ($1,$2,$3,null,'internal.pdf',$7,$6,false)`, [ids.org, ids.cA, ids.pA, ids.d1, path, ids.designer, hiddenPath])) === "ok");
});
await as("clientA", async () => {
  check("client reads shared object only", (await count(`select * from storage.objects`)) === 1);
  check("client cannot upload", (await tryq(`insert into storage.objects (bucket_id, name) values ('crm-files',$1)`, [`${ids.org}/z.pdf`])).includes("row-level security"));
  check("client cannot delete file rows", (await count(`delete from files returning id`)) === 0);
});
await as("clientB", async () => {
  check("client B reads no objects", (await count(`select * from storage.objects`)) === 0);
});
await as("outsider", async () => {
  check("other org admin sees nothing", (await count(`select * from files`)) === 0 && (await count(`select * from projects`)) === 0);
});
await as(null, async () => {
  check("anon reads nothing", String(await count(`select * from clients`)).includes("permission denied"));
});


console.log("\nLead portal logins");
await user("leadUser", "lead@x.in"); await user("leadUser2", "lead2@x.in");
const ldA = (await one(`insert into leads (organization_id, company_name, contact_person, email) values ($1,'Sri Chaitanya','Ravi','ravi@x.in') returning id`, [ids.org])).id;
const ldB = (await one(`insert into leads (organization_id, company_name) values ($1,'Narayana') returning id`, [ids.org])).id;
check("member_lead_link: lead role needs a lead", (await tryq(`insert into organization_members (organization_id,user_id,role) values ($1,$2,'lead')`, [ids.org, ids.leadUser])).includes("member_lead_link"));
check("member_lead_link: staff can't carry a lead", (await tryq(`insert into organization_members (organization_id,user_id,role,lead_id) values ($1,$2,'team_member',$3)`, [ids.org, ids.leadUser, ldA])).includes("member_lead_link"));
await db.query(`insert into organization_members (organization_id,user_id,role,lead_id) values ($1,$2,'lead',$3), ($1,$4,'lead',$5)`, [ids.org, ids.leadUser, ldA, ids.leadUser2, ldB]);
const lq = await one(`insert into quotations (organization_id, lead_id, title, status) values ($1,$2,'Prospectus design','sent') returning id`, [ids.org, ldA]);
const lqDraft = await one(`insert into quotations (organization_id, lead_id, title) values ($1,$2,'Draft idea') returning id`, [ids.org, ldA]);
await db.query(`insert into quotation_items (organization_id, quotation_id, position, name, quantity, unit_price, tax_rate) values ($1,$2,0,'Design',1,10000,18)`, [ids.org, lq.id]);
await as("leadUser", async () => {
  check("lead sees own sent quotation only (not drafts)", (await count(`select id from quotations`)) === 1);
  check("lead sees its quotation items", (await count(`select id from quotation_items`)) === 1);
  check("lead_portal_me returns the lead", (await one(`select company_name from lead_portal_me()`))?.company_name === "Sri Chaitanya");
  check("lead sees no leads/clients/projects/invoices", (await count(`select id from leads`)) === 0 && (await count(`select id from clients`)) === 0 && (await count(`select id from projects`)) === 0 && (await count(`select id from invoices`)) === 0);
  check("lead can read company settings (for the PDF)", (await count(`select organization_id from company_settings`)) === 1);
  await db.query(`select client_mark_quotation_viewed($1)`, [lq.id]);
  check("lead marks quotation viewed", (await one(`select status from quotations where id=$1`, [lq.id])).status === "viewed");
  check("lead cannot respond to a draft", (await tryq(`select client_respond_quotation($1, true)`, [lqDraft.id])) !== "ok");
  check("lead can't update quotations directly", (await count(`update quotations set total = 1 returning id`)) === 0);
});
await as("leadUser2", async () => {
  check("other lead sees none of it", (await count(`select id from quotations`)) === 0);
  check("other lead cannot respond", (await tryq(`select client_respond_quotation($1, false)`, [lq.id])).includes("not found"));
});
await as("clientA", async () => {
  check("client can't see lead quotations", (await count(`select id from quotations where lead_id is not null`)) === 0);
});
await as("leadUser", async () => {
  check("lead accepts quotation", (await tryq(`select client_respond_quotation($1, true, 'Go ahead')`, [lq.id])) === "ok");
});
await as("manager", async () => {
  const r = await db.query(`select convert_lead($1) r`, [ldA]).then((x) => x.rows[0].r).catch((e) => e.message);
  check("convert_lead works with a lead login", typeof r === "object" && r.client_id, r);
  ids.cLead = r.client_id;
});
const promoted = await one(`select role, client_id, lead_id from organization_members where user_id=$1`, [ids.leadUser]);
check("lead login became a client login", promoted.role === "client" && promoted.client_id === ids.cLead && promoted.lead_id === null, promoted);
await as("leadUser", async () => {
  check("converted login sees its quotation as a client", (await count(`select id from quotations where client_id=$1`, [ids.cLead])) === 1);
  check("converted login sees no lead portal", (await count(`select * from lead_portal_me()`)) === 0);
});
await as("manager", async () => {
  check("manager can't call promote_lead_logins for an unconverted lead", (await tryq(`select promote_lead_logins($1,$2)`, [ldB, ids.cA])).includes("Not allowed"));
});

console.log("\nReminders");
await db.query(`update tasks set due_date = current_date - 1, status='todo' where id=$1`, [ids.task]);
await db.query(`update invoices set status='unpaid' where id=$1`, [inv.id]).catch(() => {});
const n1 = (await one(`select generate_due_reminders() n`)).n;
const n2 = (await one(`select generate_due_reminders() n`)).n;
check("reminders generated then idempotent", n1 >= 1 && n2 === 0, { n1, n2 });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
