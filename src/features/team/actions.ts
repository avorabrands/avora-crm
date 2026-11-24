"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, formToObject, ok, toActionError, unwrap, zDate, zRequired, zText, type ActionState } from "@/lib/actions";
import { inviteUser } from "./invite";

const staffRoles = ["admin", "manager", "team_member"] as const;
const memberSchema = z.object({
  full_name: zRequired("Name", 120),
  email: z.email("Enter a valid email"),
  phone: zText(30),
  role: z.enum(staffRoles, { error: "Choose a role" }),
  department: zText(80),
  designation: zText(80),
  employee_code: zText(30),
  joining_date: zDate,
});

export async function addTeamMember(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("team.manage");
    const v = memberSchema.parse(formToObject(fd));
    const r = await inviteUser({ orgId: s.orgId, email: v.email, fullName: v.full_name, role: v.role, department: v.department, designation: v.designation, employeeCode: v.employee_code, joiningDate: v.joining_date, phone: v.phone });
    revalidatePath("/team");
    return ok(r.message);
  } catch (e) { return toActionError(e); }
}

const updateSchema = memberSchema.omit({ email: true, full_name: true, phone: true }).extend({ status: z.enum(["active", "inactive"]) });

export async function updateTeamMember(memberId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("team.manage");
    const v = updateSchema.parse(formToObject(fd));
    if (memberId === s.memberId && (v.role !== "admin" || v.status !== "active")) return fail("You can't remove your own admin access.");
    const supabase = await createClient();
    unwrap(await supabase.from("organization_members").update(v).eq("id", memberId).neq("role", "client").select("id").single());
    revalidatePath("/team");
    return ok("Team member updated");
  } catch (e) { return toActionError(e); }
}
