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

export type MemberRow = { id: string; user_id: string; role: string; department: string | null; designation: string | null; employee_code: string | null; joining_date: string | null; status: string; profile: { full_name: string; email: string; phone: string | null } | null };

function Fields({ m }: { m?: MemberRow }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {!m && <>
        <Field name="full_name" label="Full name" required><Input name="full_name" /></Field>
        <Field name="email" label="Work email" required><Input name="email" type="email" /></Field>
        <Field name="phone" label="Phone"><Input name="phone" type="tel" /></Field>
      </>}
      <Field name="role" label="Role" required hint="Admin: full access · Manager: sales, projects, finance · Team member: assigned work only">
        <NativeSelect name="role" defaultValue={m?.role ?? "team_member"}>{STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</NativeSelect>
      </Field>
      <Field name="employee_code" label="Employee ID"><Input name="employee_code" defaultValue={m?.employee_code ?? ""} placeholder="AVB-014" /></Field>
      <Field name="department" label="Department"><Input name="department" defaultValue={m?.department ?? ""} placeholder="Design" /></Field>
      <Field name="designation" label="Designation"><Input name="designation" defaultValue={m?.designation ?? ""} placeholder="Senior Designer" /></Field>
      <Field name="joining_date" label="Joining date"><Input type="date" name="joining_date" defaultValue={m?.joining_date ?? ""} /></Field>
      {!m && <div className="grid gap-1.5 border-t pt-4 sm:col-span-2"><p className="text-xs font-medium">How will they sign in?</p><LoginFields /></div>}
      {m && <Field name="status" label="Account status"><NativeSelect name="status" defaultValue={m.status === "inactive" ? "inactive" : "active"}><option value="active">Active</option><option value="inactive">Inactive (no access)</option></NativeSelect></Field>}
    </div>
  );
}

export function AddMemberButton() {
  return <FormDialog trigger={<Button><Plus /> Add employee</Button>} title="Add employee" description="Creates their sign-in for the CRM. Their role decides what they can see." action={addTeamMember} submitLabel="Create sign-in" size="lg"><Fields /></FormDialog>;
}

export function EditMember({ m, action }: { m: MemberRow; action: FormAction }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <SetPasswordButton memberId={m.id} name={m.profile?.full_name} email={m.profile?.email} />
      <RowActions editAs="dialog" editTitle={`Edit ${m.profile?.full_name ?? "member"}`} edit={action} editForm={<Fields m={m} />} />
    </div>
  );
}
