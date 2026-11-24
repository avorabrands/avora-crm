// Production bootstrap: creates the organisation and its first admin — no demo data.
//   node --env-file=.env.local scripts/create-admin.mjs you@avorabrands.com "Your Name"
// Sends a Supabase invite email so the admin sets their own password.
import { createClient } from "@supabase/supabase-js";

const [email, name = "Owner"] = process.argv.slice(2);
if (!email) { console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs <email> "<name>"'); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

let { data: org } = await db.from("organizations").select("id").eq("slug", "avora-brands").maybeSingle();
if (!org) {
  ({ data: org } = await db.from("organizations").insert({ name: "Avora Brands", slug: "avora-brands" }).select("id").single());
  await db.from("company_settings").insert({ organization_id: org.id });
}
const { data: invited, error } = await db.auth.admin.inviteUserByEmail(email, { data: { full_name: name }, redirectTo: `${site}/auth/callback?next=/reset-password` });
if (error) { console.error(error.message); process.exit(1); }
await db.from("profiles").upsert({ id: invited.user.id, email, full_name: name });
const { error: mErr } = await db.from("organization_members").upsert({ organization_id: org.id, user_id: invited.user.id, role: "admin", status: "active" }, { onConflict: "organization_id,user_id" });
if (mErr) { console.error(mErr.message); process.exit(1); }
console.log(`✓ ${email} is the admin of Avora Brands. Check the inbox for the invite link.`);
