"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionTrigger } from "@/components/app/confirm";
import { Field, FormDialog, type FormAction } from "@/components/app/form";
import { PersonCell } from "@/components/app/user-avatar";
import { Pill } from "@/components/app/status-badge";
import { LoginFields, SetPasswordButton } from "@/features/team/login-fields";

export type PortalUser = { id: string; status: string; profile: { full_name: string; email: string } | null };
type Result = { ok: boolean; message?: string };

/** Sign-ins for a client (full portal) or a lead (quotations only). Managing them is owner/admin only. */
export function PortalAccess({ users, invite, toggle, canManage, defaultName, defaultEmail, kind = "client" }: {
  users: PortalUser[]; invite: FormAction; toggle: (memberId: string, active: boolean) => Promise<Result>; canManage: boolean;
  defaultName?: string | null; defaultEmail?: string | null; kind?: "client" | "lead";
}) {
  const empty = kind === "lead" ? "This lead can't sign in yet." : "No one at this client can sign in to the portal yet.";
  const sees = kind === "lead"
    ? "They'll see only the quotations you send them, and can download, accept or decline them. If you convert the lead to a client, the same sign-in moves to the full client portal."
    : "They'll see only this client's shared projects, approvals, files, quotations and invoices.";
  return (
    <div className="space-y-3">
      {users.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : users.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center justify-between gap-2">
          <PersonCell name={u.profile?.full_name} sub={u.profile?.email} />
          <div className="flex items-center gap-1">
            <Pill tone={u.status === "active" ? "green" : "slate"}>{u.status === "active" ? "active" : "disabled"}</Pill>
            {canManage && <>
              <SetPasswordButton memberId={u.id} name={u.profile?.full_name} email={u.profile?.email} />
              <ActionTrigger action={() => toggle(u.id, u.status !== "active")} className="px-2 text-xs text-muted-foreground hover:text-foreground">
                {u.status === "active" ? "Disable" : "Enable"}
              </ActionTrigger>
            </>}
          </div>
        </div>
      ))}
      {canManage && (
        <FormDialog trigger={<Button variant="outline" size="sm"><UserPlus /> Create sign-in</Button>} title={kind === "lead" ? "Create a sign-in for this lead" : "Create a portal sign-in"} description={sees} action={invite} submitLabel="Create sign-in" size="lg">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="full_name" label="Full name" required><Input name="full_name" defaultValue={defaultName ?? ""} /></Field>
            <Field name="email" label="Email (their username)" required><Input name="email" type="email" defaultValue={defaultEmail ?? ""} /></Field>
          </div>
          <div className="grid gap-1.5"><p className="text-xs font-medium">How will they sign in?</p><LoginFields /></div>
        </FormDialog>
      )}
    </div>
  );
}
