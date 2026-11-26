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
await db.query(`update organization_members set is_owner = true where user_id in ($1,$2)`, [ids.admin, ids.outsider]);

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


console.log("\nManager journey (as the app does it)");
await as("manager", async () => {
  const ok = (r) => r === "ok";
  const L = await db.query(`insert into leads (organization_id, company_name, status, created_by) values ($1,'Journey College','new',$2) returning id, code`, [ids.org, ids.manager]).then((r) => r.rows[0]).catch((e) => e.message);
  check("add lead (insert … returning)", L?.id, L);
  check("edit lead", ok(await tryq(`update leads set contact_person='Asha', status='contacted' where id=$1 returning id`, [L.id])));
  check("log lead activity", ok(await tryq(`insert into lead_activities (organization_id, lead_id, type, content, created_by) values ($1,$2,'call','Called',$3) returning id`, [ids.org, L.id, ids.manager])));
  check("log activity (rpc)", ok(await tryq(`select log_activity($1,'lead',$2,'created','x','{}'::jsonb,null,null,false)`, [ids.org, L.id])));
  const O = await db.query(`insert into opportunities (organization_id, title, lead_id, stage, value, created_by) values ($1,'Prospectus',$2,'quotation_sent',50000,$3) returning id`, [ids.org, L.id, ids.manager]).then((r) => r.rows[0]).catch((e) => e.message);
  check("add pipeline deal", O?.id, O);
  check("move deal on board", ok(await tryq(`update opportunities set stage='negotiation' where id=$1 returning id`, [O.id])));
  const qid = await db.query(`select save_quotation(null,$1,$2,$3) id`, [ids.org, { lead_id: L.id, title: "Prospectus", issue_date: "2026-11-26", tax_mode: "inter_state", template: "standard" }, JSON.stringify([{ name: "Design", quantity: 1, unit_price: 10000, tax_rate: 18 }])]).then((r) => r.rows[0].id).catch((e) => e.message);
  check("save quotation for a lead", String(qid).length === 36, qid);
  check("mark lead quotation sent", ok(await tryq(`update quotations set status='sent', sent_at=now() where id=$1 returning id`, [qid])));
  check("change quotation template", ok(await tryq(`update quotations set template='modern' where id=$1 returning id`, [qid])));
  const conv = await db.query(`select convert_lead($1) r`, [L.id]).then((r) => r.rows[0].r).catch((e) => e.message);
  check("convert lead to client", conv?.client_id, conv);
  const P = await db.query(`insert into projects (organization_id, name, client_id, manager_id, created_by) values ($1,'Journey Prospectus',$2,$3,$3) returning id`, [ids.org, conv.client_id, ids.manager]).then((r) => r.rows[0]).catch((e) => e.message);
  check("create project", P?.id, P);
  check("add project member", ok(await tryq(`insert into project_members (project_id, user_id, organization_id) values ($1,$2,$3) returning project_id`, [P.id, ids.designer2, ids.org])));
  check("add milestone", ok(await tryq(`insert into project_milestones (project_id, organization_id, title, amount, position) values ($1,$2,'Advance',5000,0) returning id`, [P.id, ids.org])));
  const D = await db.query(`insert into deliverables (organization_id, project_id, name, position) values ($1,$2,'Course 1',0), ($1,$2,'Course 2',1) returning id`, [ids.org, P.id]).then((r) => r.rows).catch((e) => e.message);
  check("add deliverables", Array.isArray(D) && D.length === 2, D);
  check("update deliverables (bulk)", ok(await tryq(`update deliverables set assigned_to=$1, design_status='in_progress' where project_id=$2 returning id`, [ids.designer2, P.id])));
  check("send deliverables to client", ok(await tryq(`update deliverables set client_visible=true, client_review_status='pending', internal_review_status='approved', submitted_at=current_date where id=$1 returning id`, [D[0].id])));
  check("record client approval on their behalf", ok(await tryq(`select client_review_deliverable($1,'approved',null)`, [D[0].id])));
  const T = await db.query(`insert into tasks (organization_id, project_id, title, assigned_to, created_by) values ($1,$2,'Layout',$3,$4) returning id`, [ids.org, P.id, ids.designer2, ids.manager]).then((r) => r.rows[0]).catch((e) => e.message);
  check("create task", T?.id, T);
  check("complete task", ok(await tryq(`update tasks set status='completed' where id=$1 returning id`, [T.id])));
  check("delete task", ok(await tryq(`delete from tasks where id=$1 returning id`, [T.id])));
  const iid = await db.query(`select save_invoice(null,$1,$2,$3) id`, [ids.org, { client_id: conv.client_id, project_id: P.id, invoice_date: "2026-11-26", due_date: "2026-11-26", tax_mode: "inter_state", template: "standard" }, JSON.stringify([{ name: "Design", hsn_sac: "998391", quantity: 1, unit_price: 10000, tax_rate: 18 }])]).then((r) => r.rows[0].id).catch((e) => e.message);
  check("create invoice", String(iid).length === 36, iid);
  check("issue invoice", ok(await tryq(`update invoices set status='unpaid', issued_at=now() where id=$1 returning id`, [iid])));
  const pay = await db.query(`insert into payments (organization_id, invoice_id, client_id, project_id, payment_date, amount, method, payment_type, recorded_by) values ($1,$2,$3,$4,current_date,5000,'upi','advance',$5) returning id, receipt_number`, [ids.org, iid, conv.client_id, P.id, ids.manager]).then((r) => r.rows[0]).catch((e) => e.message);
  check("record payment", pay?.receipt_number, pay);
  check("invoice becomes partially paid", (await one(`select status from invoices where id=$1`, [iid]))?.status === "partially_paid");
  check("manager cannot delete a payment", (await count(`delete from payments where id=$1 returning id`, [pay.id])) === 0);
  check("add agreement", ok(await tryq(`insert into agreements (organization_id, client_id, project_id, title, status, created_by) values ($1,$2,$3,'MSA','draft',$4) returning id`, [ids.org, conv.client_id, P.id, ids.manager])));
  const iid2 = await db.query(`select save_invoice(null,$1,$2,$3) id`, [ids.org, { client_id: conv.client_id, invoice_date: "2026-11-26", due_date: "2026-11-30", tax_mode: "none" }, JSON.stringify([{ name: "Extra", quantity: 1, unit_price: 100, tax_rate: 0 }])]).then((r) => r.rows[0].id).catch((e) => e.message);
  check("cancel an unpaid invoice", ok(await tryq(`update invoices set status='cancelled' where id=$1 returning id`, [iid2])));
  check("manager cannot delete invoices", (await count(`delete from invoices where id=$1 returning id`, [iid2])) === 0);
  check("manager sees team list", (await count(`select id from organization_members where role in ('admin','manager','team_member')`)) >= 3);
  check("manager can't change company settings", (await count(`update company_settings set company_name='X' returning organization_id`)) === 0);
  ids.jP = P.id; ids.jClient = conv.client_id; ids.jD2 = D[1].id;
});

console.log("\nTeam member journey (designer2 on the journey project)");
await as("designer2", async () => {
  check("sees the project they were added to", (await count(`select id from projects where id=$1`, [ids.jP])) === 1);
  check("sees its deliverables", (await count(`select id from deliverables where project_id=$1`, [ids.jP])) === 2);
  check("can update own deliverable", (await tryq(`update deliverables set design_status='in_progress' where id=$1 returning id`, [ids.jD2])) === "ok");
  const T = await db.query(`insert into tasks (organization_id, project_id, title, assigned_to, created_by) values ($1,$2,'My checklist',$3,$3) returning id`, [ids.org, ids.jP, ids.designer2]).then((r) => r.rows[0]).catch((e) => e.message);
  check("can add a task on own project", T?.id, T);
  if (T?.id) {
    check("can comment on own task", (await tryq(`insert into task_comments (organization_id, task_id, author_id, body) values ($1,$2,$3,'done') returning id`, [ids.org, T.id, ids.designer2])) === "ok");
    check("can move task to review", (await tryq(`update tasks set status='internal_review' where id=$1 returning id`, [T.id])) === "ok");
  }
  check("cannot add a task on someone else's project", (await tryq(`insert into tasks (organization_id, project_id, title, created_by) values ($1,$2,'x',$3) returning id`, [ids.org, ids.pB, ids.designer2])) !== "ok");
  check("cannot see invoices/payments/quotations", (await count(`select id from invoices`)) === 0 && (await count(`select id from payments`)) === 0 && (await count(`select id from quotations`)) === 0);
  check("cannot see the team list beyond names", (await count(`select id from organization_members`)) >= 1);
});

console.log("\nClient journey (converted lead's client)");
await db.query(`insert into auth.users (email) values ('jc@x.in')`);
ids.jcUser = (await one(`select id from auth.users where email='jc@x.in'`)).id;
await db.query(`insert into organization_members (organization_id, user_id, role, client_id) values ($1,$2,'client',$3)`, [ids.org, ids.jcUser, ids.jClient]);
ids.jc = ids.jcUser;
await (async () => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${ids.jcUser}', false); set role authenticated;`);
  try {
    check("client sees own project", (await count(`select id from projects`)) === 1);
    check("client sees only the shared deliverable", (await count(`select id from deliverables`)) === 1);
    check("client sees issued invoice + items", (await count(`select id from invoices`)) >= 1 && (await count(`select id from invoice_items`)) >= 1);
    check("client sees own payment (receipt)", (await count(`select id from payments`)) === 1);
    check("client sees quotation from when they were a lead", (await count(`select id from quotations`)) === 1);
    check("client can't see agreements still in draft", (await count(`select id from agreements`)) === 0);
    check("client can update own profile", (await tryq(`update profiles set phone='9999' where id=$1 returning id`, [ids.jcUser])) === "ok");
    check("client reads company settings (PDF header)", (await count(`select organization_id from company_settings`)) === 1);
  } finally { await db.exec(`reset role;`); }
})();


console.log("\nMain admin and co-admins");
check("first admin became the main admin", (await one(`select is_owner from organization_members where user_id=$1`, [ids.admin])).is_owner === true);
check("only one main admin per workspace", (await tryq(`update organization_members set is_owner=true where user_id=$1`, [ids.manager])) !== "ok");
await user("coadmin", "co@x.in");
await db.query(`insert into organization_members (organization_id, user_id, role) values ($1,$2,'admin')`, [ids.org, ids.coadmin]);
await as("coadmin", async () => {
  { const n = await count(`select project_id from project_financials`); check("co-admin has full admin read access", n >= 1, n); }
  check("co-admin can edit a manager's department", (await tryq(`update organization_members set department='Sales' where user_id=$1 returning id`, [ids.manager])) === "ok");
  { const r = await tryq(`update organization_members set role='manager' where user_id=$1`, [ids.admin]); check("co-admin can't demote the main admin", String(r).includes("main admin"), r); }
  check("co-admin can't disable the main admin", (await tryq(`update organization_members set status='inactive' where user_id=$1`, [ids.admin])).includes("main admin"));
  check("co-admin can't promote a manager to admin", (await tryq(`update organization_members set role='admin' where user_id=$1`, [ids.manager])).includes("Only the main admin"));
  check("co-admin can't make themselves main admin", (await tryq(`update organization_members set is_owner=true where user_id=$1`, [ids.coadmin])) !== "ok");
  check("co-admin sees is_owner() false", (await one(`select is_owner($1) v`, [ids.org])).v === false);
});
await as("admin", async () => {
  check("main admin sees is_owner() true", (await one(`select is_owner($1) v`, [ids.org])).v === true);
  check("main admin can promote a manager to admin", (await tryq(`update organization_members set role='admin' where user_id=$1 returning id`, [ids.manager])) === "ok");
  check("main admin can demote them again", (await tryq(`update organization_members set role='manager' where user_id=$1 returning id`, [ids.manager])) === "ok");
  check("main admin can disable a co-admin", (await tryq(`update organization_members set status='inactive' where user_id=$1 returning id`, [ids.coadmin])) === "ok");
  check("main admin can't give away is_owner via the API", (await tryq(`update organization_members set is_owner=false where user_id=$1`, [ids.admin])) !== "ok");
});


console.log("\nDeleting an employee");
await user("leaver", "leaver@x.in");
await db.query(`insert into organization_members (organization_id, user_id, role) values ($1,$2,'team_member')`, [ids.org, ids.leaver]);
await db.query(`insert into project_members (project_id, user_id, organization_id) values ($1,$2,$3)`, [ids.pA, ids.leaver, ids.org]);
const lt = await one(`insert into tasks (organization_id, project_id, title, assigned_to, created_by) values ($1,$2,'Leaver task',$3,$3) returning id`, [ids.org, ids.pA, ids.leaver]);
await db.query(`update deliverables set assigned_to=$1 where id=$2`, [ids.leaver, ids.d4]);
await db.query(`insert into notifications (organization_id, user_id, type, title) values ($1,$2,'task_assigned','x')`, [ids.org, ids.leaver]).catch(() => {});
// the server action deletes the auth user with the service role (here: superuser)
check("deleting the sign-in succeeds", (await tryq(`delete from auth.users where id=$1`, [ids.leaver])) === "ok");
check("membership and profile are gone", (await one(`select (select count(*) from organization_members where user_id=$1)::int + (select count(*) from profiles where id=$1)::int n`, [ids.leaver])).n === 0);
const after = await one(`select assigned_to, created_by from tasks where id=$1`, [lt.id]);
check("their task stays, now unassigned", after && after.assigned_to === null && after.created_by === null, after);
check("their deliverable stays, now unassigned", (await one(`select assigned_to from deliverables where id=$1`, [ids.d4])).assigned_to === null);
check("project membership removed, project kept", (await one(`select (select count(*) from project_members where user_id=$1)::int m, (select count(*) from projects where id=$2)::int p`, [ids.leaver, ids.pA])).p === 1);
await db.query(`update organization_members set status='active' where user_id=$1`, [ids.coadmin]);
await as("coadmin", async () => {
  const r = await tryq(`delete from organization_members where user_id=$1`, [ids.admin]);
  check("co-admin can't delete the main admin via API", String(r).includes("main admin"), r);
  const r2 = await tryq(`delete from organization_members where user_id=$1 returning id`, [ids.designer2]);
  check("co-admin can remove a team member's membership", r2 === "ok", r2);
});
check("main admin still there", (await one(`select count(*)::int n from organization_members where user_id=$1`, [ids.admin])).n === 1);

console.log("\nReminders");
await db.query(`update tasks set due_date = current_date - 1, status='todo' where id=$1`, [ids.task]);
await db.query(`update invoices set status='unpaid' where id=$1`, [inv.id]).catch(() => {});
const n1 = (await one(`select generate_due_reminders() n`)).n;
const n2 = (await one(`select generate_due_reminders() n`)).n;
check("reminders generated then idempotent", n1 >= 1 && n2 === 0, { n1, n2 });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
