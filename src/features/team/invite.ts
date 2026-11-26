import "server-only";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import type { Role } from "@/lib/constants";

const NOT_CONFIGURED = "SUPABASE_SERVICE_ROLE_KEY is not set on the server, so sign-ins can't be created or changed yet. Add it in Vercel → Settings → Environment Variables (see docs/SUPABASE.md).";

function admin() {
  if (!isAdminClientConfigured()) throw { code: "CONFIG", message: NOT_CONFIGURED };
  return createAdminClient();
}

export type LoginMethod = "password" | "invite";

/**
 * Creates (or reuses) a sign-in and links it to the organisation.
 * - method "password": the admin chose the password; the account is ready immediately (no email sent).
 * - method "invite":   Supabase emails a link so the person sets their own password.
 * Caller MUST have verified the current user is an admin.
 */
export async function inviteUser(input: {
  orgId: string; email: string; fullName: string; role: Role; clientId?: string | null; leadId?: string | null;
  method?: LoginMethod; password?: string | null;
  department?: string | null; designation?: string | null; employeeCode?: string | null; joiningDate?: string | null; phone?: string | null;
}) {
  const db = admin();
  const email = input.email.toLowerCase();
  const method = input.method ?? "invite";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // reuse an existing profile if this email already has an account
  const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  let userId = existing?.id as string | undefined;
  let message: string;

  if (!userId) {
    if (method === "password") {
      if (!input.password) throw { code: "22023", message: "Enter a password." };
      const { data, error } = await db.auth.admin.createUser({ email, password: input.password, email_confirm: true, user_metadata: { full_name: input.fullName } });
      if (error) throw { code: "AUTH", message: error.message };
      userId = data.user.id;
      message = `Sign-in created for ${email}. Share the password with them securely.`;
    } else {
      const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
        data: { full_name: input.fullName },
        redirectTo: `${site}/auth/callback?next=/reset-password`,
      });
      if (error) throw { code: "AUTH", message: error.message };
      userId = data.user.id;
      message = `Invitation email sent to ${email}.`;
    }
  } else {
    // never silently change an existing person's password here — use "Set password" for that
    message = `${email} already has a sign-in — access added. Their existing password still works.`;
  }

  await db.from("profiles").upsert({ id: userId, email, full_name: input.fullName, phone: input.phone ?? null }, { onConflict: "id" });

  const link = { client_id: input.role === "client" ? input.clientId ?? null : null, lead_id: input.role === "lead" ? input.leadId ?? null : null };
  const { data: member } = await db.from("organization_members").select("id, role").eq("organization_id", input.orgId).eq("user_id", userId).maybeSingle();
  if (member) {
    if (member.role !== input.role) throw { code: "23505", message: `${email} already has a sign-in here as ${member.role.replace("_", " ")}.` };
    await db.from("organization_members").update({ status: "active", ...link }).eq("id", member.id);
  } else {
    const { error } = await db.from("organization_members").insert({
      organization_id: input.orgId, user_id: userId, role: input.role, ...link,
      department: input.department ?? null, designation: input.designation ?? null, employee_code: input.employeeCode ?? null,
      joining_date: input.joiningDate ?? null, status: "active",
    });
    if (error) throw error;
  }
  return { userId, message };
}

/** Admin sets a new password for any sign-in in their organisation. */
export async function setPasswordForMember(orgId: string, memberId: string, password: string, callerIsOwner: boolean) {
  const db = admin();
  const { data: m } = await db.from("organization_members").select("user_id, is_owner, profile:profiles(email)").eq("id", memberId).eq("organization_id", orgId).maybeSingle();
  if (!m) throw { code: "P0002", message: "That sign-in wasn't found." };
  if (m.is_owner && !callerIsOwner) throw { code: "42501", message: "Only the main admin can change the main admin's password." };
  const { error } = await db.auth.admin.updateUserById(m.user_id as string, { password });
  if (error) throw { code: "AUTH", message: error.message };
  return (m.profile as unknown as { email: string } | null)?.email ?? "this person";
}

/**
 * Removes someone from the workspace. If this was their only workspace their sign-in is deleted too
 * (their name disappears; tasks/deliverables become unassigned; records they created stay).
 * Caller MUST have checked: admin, not themselves, not the main admin, only the main admin removes admins.
 */
export async function removeMember(orgId: string, memberId: string) {
  const db = admin();
  const { data: m } = await db.from("organization_members").select("id, user_id, role, is_owner, profile:profiles(email, full_name)").eq("id", memberId).eq("organization_id", orgId).maybeSingle();
  if (!m) throw { code: "P0002", message: "That person wasn't found." };
  if (m.is_owner) throw { code: "42501", message: "The main admin can't be deleted." };
  const { count } = await db.from("organization_members").select("id", { count: "exact", head: true }).eq("user_id", m.user_id).neq("id", m.id);
  if (count) {
    const { error } = await db.from("organization_members").delete().eq("id", m.id);
    if (error) throw error;
  } else {
    const { error } = await db.auth.admin.deleteUser(m.user_id as string); // cascades to profile + membership
    if (error) throw { code: "AUTH", message: error.message };
  }
  const p = m.profile as unknown as { email: string; full_name: string | null } | null;
  return p?.full_name || p?.email || "Employee";
}
