import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, isStaffRole, type Capability } from "./permissions";
import type { Role } from "@/lib/constants";

export type Session = {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  orgId: string;
  orgName: string;
  role: Role;
  clientId: string | null;
  leadId: string | null;
  memberId: string;
};

/** Reads + verifies the Supabase session once per request (React cache). */
export const getSession = cache(async (): Promise<Session | null> => {
  const claims = await getClaims();
  const userId = claims?.sub;
  if (!userId) return null;
  const supabase = await createClient();

  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, avatar_url").eq("id", userId).maybeSingle(),
    supabase
      .from("organization_members")
      .select("id, role, client_id, lead_id, organization_id, status, organizations(name)")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!member) return null;

  const org = member.organizations as unknown as { name: string } | null;
  return {
    userId,
    email: profile?.email ?? String(claims?.email ?? ""),
    fullName: profile?.full_name || profile?.email || "User",
    avatarUrl: profile?.avatar_url ?? null,
    orgId: member.organization_id,
    orgName: org?.name ?? "Avora Brands",
    role: member.role as Role,
    clientId: member.client_id,
    leadId: member.lead_id ?? null,
    memberId: member.id,
  };
});

/** Verified JWT claims, read once per request. */
const getClaims = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
});

/** Signed in AND has an active membership — otherwise to /login or /no-access. */
export async function requireSession(): Promise<Session> {
  const claims = await getClaims();
  if (!claims?.sub) redirect("/login");
  const session = await getSession();
  if (!session) redirect("/no-access");
  return session;
}

/** Where each role lands after signing in. */
export const homeFor = (role: Role) => (role === "client" ? "/portal" : role === "lead" ? "/lead" : "/dashboard");

/** Internal CRM pages. Portal users are sent to their portal. */
export async function requireStaff(capability?: Capability): Promise<Session> {
  const session = await requireSession();
  if (!isStaffRole(session.role)) redirect(homeFor(session.role));
  if (capability && !can(session.role, capability)) redirect("/dashboard?denied=1");
  return session;
}

export async function requireClient(): Promise<Session & { clientId: string }> {
  const session = await requireSession();
  if (session.role !== "client" || !session.clientId) redirect(homeFor(session.role));
  return session as Session & { clientId: string };
}

/** Lead portal (quotations only). */
export async function requireLead(): Promise<Session & { leadId: string }> {
  const session = await requireSession();
  if (session.role !== "lead" || !session.leadId) redirect(homeFor(session.role));
  return session as Session & { leadId: string };
}

export class AuthError extends Error {}

/** For server actions: throws instead of redirecting. */
export async function authorize(capability?: Capability): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError("Your session has expired. Please sign in again.");
  if (capability && !can(session.role, capability)) throw new AuthError("You don't have permission to do that.");
  return session;
}

export async function authorizeStaff(capability?: Capability): Promise<Session> {
  const session = await authorize(capability);
  if (!isStaffRole(session.role)) throw new AuthError("You don't have permission to do that.");
  return session;
}
