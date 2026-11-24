// Seeds a LOCAL / STAGING Supabase project with test users and sample data.
//   npm run seed            → creates data (skips if the org already exists)
//   npm run seed -- --reset → deletes the seeded org + test users first
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
// NEVER run against production — it creates accounts with a shared test password.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// Local-development test credentials (documented in docs/SETUP.md)
const PASSWORD = process.env.SEED_PASSWORD ?? "AvoraTest#2026";
const USERS = [
  { key: "admin", email: "admin@avora.test", name: "Praveen (Owner)", role: "admin", dept: "Leadership", title: "Founder", code: "AVB-001" },
  { key: "manager", email: "manager@avora.test", name: "Meera Iyer", role: "manager", dept: "Accounts", title: "Account Manager", code: "AVB-002" },
  { key: "designer", email: "designer@avora.test", name: "Arjun Rao", role: "team_member", dept: "Design", title: "Senior Designer", code: "AVB-003" },
  { key: "designer2", email: "designer2@avora.test", name: "Sana Khan", role: "team_member", dept: "Design", title: "Designer", code: "AVB-004" },
  { key: "client", email: "client@lumiedu.test", name: "Dr. Kavya (LumiEdu)", role: "client" },
];
const SLUG = "avora-brands";

const must = (r, what) => { if (r.error) { console.error(`✗ ${what}:`, r.error.message); process.exit(1); } return r.data; };
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function findUser(email) {
  for (let page = 1; page < 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const u = data?.users?.find((x) => x.email === email);
    if (u) return u;
    if (!data || data.users.length < 200) return null;
  }
  return null;
}

if (process.argv.includes("--reset")) {
  const { data: org } = await db.from("organizations").select("id").eq("slug", SLUG).maybeSingle();
  if (org) {
    // children with ON DELETE RESTRICT first
    for (const t of ["payments", "invoices", "quotations", "projects"]) await db.from(t).delete().eq("organization_id", org.id);
    must(await db.from("organizations").delete().eq("id", org.id), "delete org");
  }
  for (const u of USERS) { const found = await findUser(u.email); if (found) await db.auth.admin.deleteUser(found.id); }
  console.log("✓ reset done");
}

const { data: existing } = await db.from("organizations").select("id").eq("slug", SLUG).maybeSingle();
if (existing) { console.log("Organisation already seeded. Use `npm run seed -- --reset` to start over."); process.exit(0); }

const org = must(await db.from("organizations").insert({ name: "Avora Brands", slug: SLUG }).select("id").single(), "org");
must(await db.from("company_settings").insert({
  organization_id: org.id, company_name: "Avora Brands", legal_name: "Avora Brands (sample legal name)", state: "Karnataka",
  address: "Sample address — update in Settings", gstin: "29ABCDE1234F1Z5", email: "accounts@avora.test", phone: "+91 90000 00000",
  bank_details: "Bank: Sample Bank\nA/c: 000000000000\nIFSC: SAMP0000001",
  default_terms: "Prices are exclusive of printing unless stated. Two rounds of revisions included per deliverable.",
}), "settings");

// ── users ───────────────────────────────────────────────────────────────
const ids = {};
for (const u of USERS) {
  let user = await findUser(u.email);
  if (!user) user = must(await db.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: u.name } }), `user ${u.email}`).user;
  ids[u.key] = user.id;
  await db.from("profiles").upsert({ id: user.id, email: u.email, full_name: u.name });
}

// ── clients ─────────────────────────────────────────────────────────────
const [lumi, vydehi, bloom] = must(await db.from("clients").insert([
  { organization_id: org.id, company_name: "LumiEdu", contact_person: "Dr. Kavya", email: "client@lumiedu.test", phone: "+91 98450 11111", billing_address: "Bengaluru, Karnataka", state: "Karnataka", gstin: "29LUMIE1234F1Z2", category: "Education", account_manager_id: ids.manager, notes: "Prefers WhatsApp updates. Budget-conscious; approvals go via Dean." },
  { organization_id: org.id, company_name: "Vydehi Institute", contact_person: "Rahul Menon", email: "rahul@vydehi.test", phone: "+91 98450 22222", billing_address: "Whitefield, Bengaluru", state: "Karnataka", category: "Education", account_manager_id: ids.manager },
  { organization_id: org.id, company_name: "Bloom Organics", contact_person: "Nisha Patel", email: "nisha@bloom.test", billing_address: "Ahmedabad, Gujarat", state: "Gujarat", category: "Retail", account_manager_id: ids.admin },
]).select("id, company_name"), "clients");

// ── members ─────────────────────────────────────────────────────────────
must(await db.from("organization_members").insert(USERS.map((u) => ({
  organization_id: org.id, user_id: ids[u.key], role: u.role, client_id: u.role === "client" ? lumi.id : null,
  department: u.dept ?? null, designation: u.title ?? null, employee_code: u.code ?? null, joining_date: u.role === "client" ? null : day(-400),
}))), "members");

// ── leads & pipeline ────────────────────────────────────────────────────
const leadRows = [
  ["Northstar Clinics", "Dr. Anil", "new", "Website", 150000, ["Brand Identity", "Website"], 2, null],
  ["Kaveri Realty", "Priya S", "contacted", "Referral", 300000, ["Digital Marketing", "Social Media"], 1, "designer2"],
  ["TechNest Labs", "Rohit", "discussion", "LinkedIn", 220000, ["UI/UX Design"], -1, "manager"],
  ["Spice Route Café", "Fatima", "requirement_received", "Instagram", 60000, ["Graphic Design", "Print"], 3, "manager"],
  ["GreenLeaf School", "Mr. Joseph", "quotation_sent", "Event", 180000, ["Print", "Graphic Design"], 5, "manager"],
  ["Urban Threads", "Kiran", "negotiation", "Google Ads", 400000, ["Brand Identity", "Packaging"], 0, "admin"],
  ["Vydehi Institute", "Rahul Menon", "won", "Referral", 250000, ["Graphic Design"], null, "manager"],
  ["Old Mill Furniture", "Suresh", "lost", "Cold outreach", 90000, ["Website"], null, "manager"],
];
const leads = must(await db.from("leads").insert(leadRows.map(([company, contact, status, source, budget, services, fu, owner]) => ({
  organization_id: org.id, company_name: company, contact_person: contact, status, source, estimated_budget: budget, services, location: "Bengaluru",
  next_follow_up: fu === null ? null : day(fu), assigned_to: owner ? ids[owner] : null, created_by: ids.manager, email: `${company.split(" ")[0].toLowerCase()}@example.test`,
  converted_client_id: company === "Vydehi Institute" ? vydehi.id : null, converted_at: company === "Vydehi Institute" ? new Date().toISOString() : null,
}))).select("id, company_name, status, estimated_budget, assigned_to"), "leads");
await db.from("lead_activities").insert(leads.slice(1, 6).map((l) => ({ organization_id: org.id, lead_id: l.id, type: "call", content: `Intro call with ${l.company_name}. Shared portfolio; awaiting brief.`, created_by: ids.manager })));
const stageOf = { discussion: "discussion", requirement_received: "discussion", quotation_sent: "quotation_sent", negotiation: "negotiation", won: "won", lost: "lost", new: "new", contacted: "new" };
await db.from("opportunities").insert(leads.map((l, i) => ({ organization_id: org.id, lead_id: l.id, client_id: l.company_name === "Vydehi Institute" ? vydehi.id : null, title: `${l.company_name} engagement`, value: l.estimated_budget, stage: stageOf[l.status], assigned_to: l.assigned_to, expected_close_date: day(10 + i * 4), position: i })));

// ── projects ────────────────────────────────────────────────────────────
const [course, brand] = must(await db.from("projects").insert([
  { organization_id: org.id, name: "Course Creative Design", client_id: lumi.id, category: "graphic_design", description: "Individual brochure design for 34 courses (LumiEdu × Vydehi programmes).", start_date: day(-30), due_date: day(20), budget: 85000, manager_id: ids.manager, priority: "high", status: "in_progress", created_by: ids.admin },
  { organization_id: org.id, name: "Bloom Organics Brand Identity", client_id: bloom.id, category: "brand_identity", description: "Logo, colour system, typography and packaging guidelines.", start_date: day(-50), due_date: day(-3), budget: 140000, manager_id: ids.admin, priority: "medium", status: "client_review", created_by: ids.admin },
]).select("id, name"), "projects");
await db.from("project_financials").insert([{ project_id: course.id, organization_id: org.id, estimated_cost: 42000 }, { project_id: brand.id, organization_id: org.id, estimated_cost: 61000, actual_cost: 58000 }]);
await db.from("project_members").insert([
  { project_id: course.id, user_id: ids.designer, organization_id: org.id, role_label: "Lead designer" },
  { project_id: course.id, user_id: ids.designer2, organization_id: org.id, role_label: "Designer" },
  { project_id: brand.id, user_id: ids.designer, organization_id: org.id, role_label: "Brand designer" },
]);
await db.from("project_milestones").insert([
  { organization_id: org.id, project_id: course.id, title: "Content received for all courses", due_date: day(-10), status: "completed", position: 0 },
  { organization_id: org.id, project_id: course.id, title: "First drafts — all 34 brochures", due_date: day(7), amount: 42500, status: "in_progress", position: 1 },
  { organization_id: org.id, project_id: course.id, title: "Final print-ready files", due_date: day(20), amount: 42500, status: "pending", position: 2 },
]);

const COURSES = ["B.Sc Nursing", "GNM Nursing", "Post Basic B.Sc Nursing", "M.Sc Nursing", "BPT Physiotherapy", "MPT Physiotherapy", "B.Pharm", "D.Pharm", "Pharm.D", "M.Pharm",
  "BMLT", "B.Sc Radiology", "B.Sc Anaesthesia Technology", "B.Sc Cardiac Care", "B.Sc Dialysis Technology", "B.Sc Optometry", "B.Sc Operation Theatre Tech", "B.Sc Respiratory Care",
  "BHA Hospital Administration", "MHA Hospital Administration", "MBA Healthcare Management", "BBA Aviation", "BCA", "B.Com", "BBA", "B.Sc Psychology", "M.Sc Clinical Psychology",
  "B.Sc Nutrition & Dietetics", "B.Sc Forensic Science", "B.Sc Microbiology", "B.Sc Biotechnology", "MBBS Counselling Desk", "Bridge Course — Biology", "Foundation Programme"];
const stage = (i) => i < 9 ? "approved" : i < 13 ? "client" : i < 16 ? "revision" : i < 21 ? "internal" : i < 27 ? "design" : i < 31 ? "content" : "none";
const delRows = COURSES.map((name, i) => {
  const s = stage(i);
  return {
    organization_id: org.id, project_id: course.id, name, position: i + 1, assigned_to: i % 2 ? ids.designer2 : ids.designer,
    content_received: s !== "none", content_received_at: s !== "none" ? day(-20) : null,
    design_status: ["approved", "client", "revision", "internal"].includes(s) ? "completed" : s === "design" ? "in_progress" : "not_started",
    internal_review_status: ["approved", "client", "revision"].includes(s) ? "approved" : s === "internal" ? "pending" : "not_started",
    client_review_status: s === "approved" ? "approved" : s === "client" ? "pending" : s === "revision" ? "changes_requested" : "not_started",
    approval_status: s === "approved" ? "approved" : s === "revision" ? "revision_requested" : "pending",
    revision_count: s === "revision" ? 1 : i < 3 ? 1 : 0, submitted_at: ["approved", "client", "revision"].includes(s) ? day(-5) : null,
    final_delivered_at: i < 4 ? day(-1) : null, client_visible: ["approved", "client", "revision"].includes(s),
  };
});
const dels = must(await db.from("deliverables").insert(delRows).select("id, name, approval_status, client_review_status"), "deliverables");
// approval / revision history for the client-facing ones
for (const d of dels.filter((x) => x.approval_status === "approved")) await db.from("approvals").insert({ organization_id: org.id, deliverable_id: d.id, decision: "approved", comment: "Looks good, approved.", decided_by: ids.client });
for (const d of dels.filter((x) => x.client_review_status === "changes_requested")) {
  const a = must(await db.from("approvals").insert({ organization_id: org.id, deliverable_id: d.id, decision: "revision_requested", comment: "Please update the fee table and use the new campus photo.", decided_by: ids.client }).select("id").single(), "approval");
  await db.from("revisions").insert({ organization_id: org.id, deliverable_id: d.id, approval_id: a.id, revision_number: 1, notes: "Please update the fee table and use the new campus photo.", requested_by: ids.client });
}

await db.from("tasks").insert([
  { organization_id: org.id, project_id: course.id, title: "Collect pending course content (3 courses)", assigned_to: ids.manager, priority: "high", due_date: day(-2), status: "in_progress", created_by: ids.manager },
  { organization_id: org.id, project_id: course.id, title: "Brochure master template v2", assigned_to: ids.designer, priority: "medium", due_date: day(1), status: "internal_review", created_by: ids.manager },
  { organization_id: org.id, project_id: course.id, title: "Apply revisions — Radiology, Anaesthesia, Cardiac Care", assigned_to: ids.designer2, priority: "urgent", due_date: day(2), status: "todo", created_by: ids.manager },
  { organization_id: org.id, project_id: course.id, title: "Print vendor quotes for 34 brochures", assigned_to: ids.manager, priority: "low", due_date: day(12), status: "todo", created_by: ids.manager },
  { organization_id: org.id, project_id: brand.id, title: "Logo concepts — round 2", assigned_to: ids.designer, priority: "high", due_date: day(-4), status: "completed", created_by: ids.admin },
  { organization_id: org.id, project_id: brand.id, title: "Packaging mockups", assigned_to: ids.designer, priority: "medium", due_date: day(-1), status: "in_progress", created_by: ids.admin },
]);

// ── quotations, invoices, payments ──────────────────────────────────────
const q1 = must(await db.from("quotations").insert({ organization_id: org.id, client_id: lumi.id, project_id: course.id, title: "Course brochure design — 34 programmes", issue_date: day(-35), valid_until: day(-5), status: "accepted", sent_at: new Date(Date.now() - 34 * 864e5).toISOString(), responded_at: new Date(Date.now() - 32 * 864e5).toISOString(), payment_terms: "50% advance, 50% on final delivery.", created_by: ids.manager }).select("id").single(), "q1");
await db.from("quotation_items").insert([
  { organization_id: org.id, quotation_id: q1.id, position: 0, name: "Course brochure design (4 pages)", quantity: 34, unit_price: 2500, discount_pct: 0, tax_rate: 18 },
]);
const q2 = must(await db.from("quotations").insert({ organization_id: org.id, lead_id: leads.find((l) => l.company_name === "GreenLeaf School").id, title: "Annual print collateral", valid_until: day(20), status: "draft", created_by: ids.manager }).select("id").single(), "q2");
await db.from("quotation_items").insert([
  { organization_id: org.id, quotation_id: q2.id, position: 0, name: "Prospectus design", quantity: 1, unit_price: 45000, tax_rate: 18 },
  { organization_id: org.id, quotation_id: q2.id, position: 1, name: "Printing — 2000 copies", quantity: 2000, unit_price: 38, tax_rate: 12 },
]);
const q3 = must(await db.from("quotations").insert({ organization_id: org.id, client_id: bloom.id, project_id: brand.id, title: "Packaging extension — 6 SKUs", valid_until: day(14), status: "sent", tax_mode: "inter_state", sent_at: new Date().toISOString(), created_by: ids.admin }).select("id").single(), "q3");
await db.from("quotation_items").insert([{ organization_id: org.id, quotation_id: q3.id, position: 0, name: "Packaging design per SKU", quantity: 6, unit_price: 9000, discount_pct: 5, tax_rate: 18 }]);

const inv1 = must(await db.from("invoices").insert({ organization_id: org.id, client_id: lumi.id, project_id: course.id, quotation_id: q1.id, invoice_date: day(-30), due_date: day(-20), status: "unpaid", notes: "Advance — 50% of quotation", created_by: ids.manager }).select("id").single(), "inv1");
await db.from("invoice_items").insert([{ organization_id: org.id, invoice_id: inv1.id, position: 0, name: "Advance: course brochure design (50%)", hsn_sac: "998391", quantity: 1, unit_price: 42500, tax_rate: 18 }]);
const inv2 = must(await db.from("invoices").insert({ organization_id: org.id, client_id: bloom.id, project_id: brand.id, invoice_date: day(-25), due_date: day(-10), status: "unpaid", tax_mode: "inter_state", created_by: ids.admin }).select("id").single(), "inv2");
await db.from("invoice_items").insert([{ organization_id: org.id, invoice_id: inv2.id, position: 0, name: "Brand identity — milestone 1", hsn_sac: "998391", quantity: 1, unit_price: 70000, tax_rate: 18 }]);
const inv3 = must(await db.from("invoices").insert({ organization_id: org.id, client_id: vydehi.id, invoice_date: day(-3), due_date: day(12), status: "draft", created_by: ids.manager }).select("id").single(), "inv3");
await db.from("invoice_items").insert([{ organization_id: org.id, invoice_id: inv3.id, position: 0, name: "Social media creatives (12)", quantity: 12, unit_price: 1800, tax_rate: 18 }]);

must(await db.from("payments").insert([
  { organization_id: org.id, client_id: lumi.id, invoice_id: inv1.id, amount: 50150, payment_date: day(-28), method: "bank_transfer", payment_type: "advance", transaction_id: "UTR0000001", recorded_by: ids.admin },
  { organization_id: org.id, client_id: bloom.id, invoice_id: inv2.id, amount: 40000, payment_date: day(-12), method: "upi", payment_type: "partial", transaction_id: "UPI0000002", recorded_by: ids.admin },
  { organization_id: org.id, client_id: vydehi.id, amount: 15000, payment_date: day(-60), method: "cheque", payment_type: "advance", reference_number: "CHQ 104455", recorded_by: ids.admin },
]), "payments");

await db.from("activity_logs").insert([
  { organization_id: org.id, actor_id: ids.manager, entity_type: "project", entity_id: course.id, action: "sent_for_review", summary: "4 course brochures shared for your review", client_id: lumi.id, project_id: course.id, client_visible: true },
  { organization_id: org.id, actor_id: ids.admin, entity_type: "payment", action: "recorded", summary: "Advance payment of ₹50,150 received", client_id: lumi.id, project_id: course.id, client_visible: true },
]);

console.log(`\n✓ Seeded "Avora Brands" (${org.id})`);
console.log("  Test accounts (password from SEED_PASSWORD or the default in this script):");
for (const u of USERS) console.log(`   • ${u.role.padEnd(12)} ${u.email}`);
