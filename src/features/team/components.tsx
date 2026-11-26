"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, NativeSelect, type FormAction } from "@/components/app/form";
import { RowActions } from "@/components/app/row-actions";
import { ROLES } from "@/lib/constants";
import { addTeamMember } from "./actions";
import { LoginFields, SetPasswordButton } from "./login-fields";

const STAFF_ROLES = ROLES.options.filter((r) => r.value !== "client" && r.value !== "lead");

export type MemberRow = { id: string; user_id: string; role: string; is_owner?: boolean; department: string | null; designation: string | null; employee_code: string | null; joining_date: string | null; status: string; profile: { full_name: string; email: string; phone: string | null } | null };

function Fields({ m, viewerIsOwner }: { m?: MemberRow; viewerIsOwner: boolean }) {
  // only the main admin can make someone an admin, or change an admin's role/status
  const lockedAdmin = !!m && m.role === "admin" && (!viewerIsOwner || m.is_owner);
  const roles = STAFF_ROLES.filter((r) => r.value !== "admin" || viewerIsOwner).map((r) => (r.value === "admin" ? { ...r, label: "Co-admin (full access)" } : r));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {!m && <>
        <Field name="full_name" label="Full name" required><Input name="full_name" /></Field>
        <Field name="email" label="Work email" required><Input name="email" type="email" /></Field>
        <Field name="phone" label="Phone"><Input name="phone" type="tel" /></Field>
      </>}
      {lockedAdmin ? (
        <Field label="Role" hint={m?.is_owner ? "The main admin's role can't be changed." : "Only the main admin can change an admin's role or access."}>
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{m?.is_owner ? "Main admin" : "Co-admin"}</p>
          <input type="hidden" name="role" value="admin" /><input type="hidden" name="status" value={m?.status === "inactive" ? "inactive" : "active"} />
        </Field>
      ) : (
        <Field name="role" label="Role" required hint={viewerIsOwner ? "Co-admin: full access (can't change the main admin) · Manager: sales, projects, finance · Team member: assigned work only" : "Manager: sales, projects, finance · Team member: assigned work only"}>
          <NativeSelect name="role" defaultValue={m?.role ?? "team_member"}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</NativeSelect>
        </Field>
      )}
      <Field name="employee_code" label="Employee ID"><Input name="employee_code" defaultValue={m?.employee_code ?? ""} placeholder="AVB-014" /></Field>
      <Field name="department" label="Department"><Input name="department" defaultValue={m?.department ?? ""} placeholder="Design" /></Field>
      <Field name="designation" label="Designation"><Input name="designation" defaultValue={m?.designation ?? ""} placeholder="Senior Designer" /></Field>
      <Field name="joining_date" label="Joining date"><Input type="date" name="joining_date" defaultValue={m?.joining_date ?? ""} /></Field>
      {!m && <div className="grid gap-1.5 border-t pt-4 sm:col-span-2"><p className="text-xs font-medium">How will they sign in?</p><LoginFields /></div>}
      {m && !lockedAdmin && <Field name="status" label="Account status"><NativeSelect name="status" defaultValue={m.status === "inactive" ? "inactive" : "active"}><option value="active">Active</option><option value="inactive">Inactive (no access)</option></NativeSelect></Field>}
    </div>
  );
}

export function AddMemberButton({ viewerIsOwner }: { viewerIsOwner: boolean }) {
  return <FormDialog trigger={<Button><Plus /> Add employee</Button>} title="Add employee" description="Creates their sign-in for the CRM. Their role decides what they can see." action={addTeamMember} submitLabel="Create sign-in" size="lg"><Fields viewerIsOwner={viewerIsOwner} /></FormDialog>;
}

export function EditMember({ m, action, viewerIsOwner }: { m: MemberRow; action: FormAction; viewerIsOwner: boolean }) {
  // co-admins can't touch the main admin at all
  if (m.is_owner && !viewerIsOwner) return <span className="text-xs text-muted-foreground">Main admin</span>;
  return (
    <div className="flex items-center justify-end gap-1">
      <SetPasswordButton memberId={m.id} name={m.profile?.full_name} email={m.profile?.email} />
      <RowActions editAs="dialog" editTitle={`Edit ${m.profile?.full_name ?? "member"}`} edit={action} editForm={<Fields m={m} viewerIsOwner={viewerIsOwner} />} />
    </div>
  );
}
