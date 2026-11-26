"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, formToObject, ok, toActionError, unwrap, type ActionState } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { inviteUser } from "@/features/team/invite";
import { parseLogin } from "@/features/team/login-schema";
import { clientSchema, portalUserSchema } from "./schema";

export async function createClientRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const s = await authorizeStaff("clients.manage");
    const v = clientSchema.parse(formToObject(fd));
    const supabase = await createClient();
    const row = unwrap(await supabase.from("clients").insert({ ...v, organization_id: s.orgId, created_by: s.userId }).select("id, code").single());
    id = row.id;
    await logActivity(supabase, s, { entityType: "client", entityId: row.id, action: "created", summary: `Client ${row.code} · ${v.company_name} created`, clientId: row.id });
    revalidatePath("/clients");
  } catch (e) { return toActionError(e); }
  redirect(`/clients/${id}`);
}

export async function updateClientRecord(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("clients.manage");
    const v = clientSchema.parse(formToObject(fd));
    const supabase = await createClient();
    unwrap(await supabase.from("clients").update(v).eq("id", id).select("id").single());
    await logActivity(supabase, s, { entityType: "client", entityId: id, action: "updated", summary: `Client details updated`, clientId: id });
    revalidatePath("/clients"); revalidatePath(`/clients/${id}`);
    return ok("Client updated");
  } catch (e) { return toActionError(e); }
}

export async function deleteClientRecord(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("clients.delete");
    const supabase = await createClient();
    const { count } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", id);
    if (count) return fail(`This client has ${count} project(s). Mark the client inactive instead, or delete the projects first.`);
    unwrap(await supabase.from("clients").delete().eq("id", id).select("id").single());
    revalidatePath("/clients");
    return ok("Client deleted");
  } catch (e) { return toActionError(e); }
}

/** Give a client contact access to the portal (admin only; uses service role server-side). */
export async function inviteClientPortalUser(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("team.manage");
    const v = portalUserSchema.parse(formToObject(fd));
    const result = await inviteUser({ ...parseLogin(fd), orgId: s.orgId, email: v.email, fullName: v.full_name, role: "client", clientId });
    const supabase = await createClient();
    await logActivity(supabase, s, { entityType: "client", entityId: clientId, action: "portal_invite", summary: `Portal access granted to ${v.email}`, clientId });
    revalidatePath(`/clients/${clientId}`);
    return ok(result.message);
  } catch (e) { return toActionError(e); }
}

export async function setPortalAccess(clientId: string, memberId: string, active: boolean): Promise<ActionState> {
  try {
    await authorizeStaff("team.manage");
    const supabase = await createClient();
    unwrap(await supabase.from("organization_members").update({ status: active ? "active" : "inactive" }).eq("id", memberId).eq("role", "client").select("id").single());
    revalidatePath(`/clients/${clientId}`);
    return ok(active ? "Portal access restored" : "Portal access revoked");
  } catch (e) { return toActionError(e); }
}
