import "server-only";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import type { Role } from "@/lib/constants";

/**
 * Creates (or reuses) an auth user and links them to the organisation.
 * Caller MUST have verified the current user is an admin. Sends Supabase's
 * built-in invite email (configure SMTP in Supabase for production).
 */
export async function inviteUser(input: {
  orgId: string; email: string; fullName: string; role: Role; clientId?: string | null;
  department?: string | null; designation?: string | null; employeeCode?: string | null; joiningDate?: string | null; phone?: string | null;
}) {
  if (!isAdminClientConfigured()) {
    throw { code: "CONFIG", message: "SUPABASE_SERVICE_ROLE_KEY is not set on the server, so users can't be invited yet. See docs/SUPABASE.md." };
  }
  const admin = createAdminClient();
  const email = input.email.toLowerCase();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // reuse an existing profile if this email already has an account
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  let userId = existing?.id as string | undefined;
  let message: string;

  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: input.fullName },
      redirectTo: `${site}/auth/callback?next=/reset-password`,
    });
    if (error) throw { code: "AUTH", message: error.message };
    userId = data.user.id;
    message = `Invitation email sent to ${email} via Supabase Auth.`;
  } else {
    message = `${email} already has an account — access added.`;
  }

  await admin.from("profiles").upsert({ id: userId, email, full_name: input.fullName, phone: input.phone ?? null }, { onConflict: "id" });

  const { data: member } = await admin.from("organization_members").select("id, role").eq("organization_id", input.orgId).eq("user_id", userId).maybeSingle();
  if (member) {
    if (member.role !== input.role) throw { code: "23505", message: `${email} is already a member of this workspace as ${member.role}.` };
    await admin.from("organization_members").update({ status: "active", client_id: input.clientId ?? null }).eq("id", member.id);
  } else {
    const { error } = await admin.from("organization_members").insert({
      organization_id: input.orgId, user_id: userId, role: input.role, client_id: input.role === "client" ? input.clientId : null,
      department: input.department ?? null, designation: input.designation ?? null, employee_code: input.employeeCode ?? null,
      joining_date: input.joiningDate ?? null, status: "active",
    });
    if (error) throw error;
  }
  return { userId, message };
}
