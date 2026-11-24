"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionTrigger } from "@/components/app/confirm";
import { Field, FormDialog, type FormAction } from "@/components/app/form";
import { PersonCell } from "@/components/app/user-avatar";
import { Pill } from "@/components/app/status-badge";
import { setPortalAccess } from "../actions";

export type PortalUser = { id: string; status: string; profile: { full_name: string; email: string } | null };

export function PortalAccess({ clientId, users, invite, canManage, defaultName, defaultEmail }: { clientId: string; users: PortalUser[]; invite: FormAction; canManage: boolean; defaultName?: string | null; defaultEmail?: string | null }) {
  return (
    <div className="space-y-3">
      {users.length === 0 ? <p className="text-sm text-muted-foreground">No one at this client can sign in to the portal yet.</p> : users.map((u) => (
        <div key={u.id} className="flex items-center justify-between gap-2">
          <PersonCell name={u.profile?.full_name} sub={u.profile?.email} />
          <div className="flex items-center gap-2">
            <Pill tone={u.status === "active" ? "green" : "slate"}>{u.status}</Pill>
            {canManage && (
              <ActionTrigger action={() => setPortalAccess(u.id, clientId, u.status !== "active")} className="text-xs text-muted-foreground hover:text-foreground">
                {u.status === "active" ? "Revoke" : "Restore"}
              </ActionTrigger>
            )}
          </div>
        </div>
      ))}
      {canManage && (
        <FormDialog trigger={<Button variant="outline" size="sm"><UserPlus /> Invite to portal</Button>} title="Invite a client contact" description="They'll receive a Supabase invitation email to set a password, then see only this client's shared projects, files, quotations and invoices." action={invite} submitLabel="Send invite">
          <Field name="full_name" label="Full name" required><Input name="full_name" defaultValue={defaultName ?? ""} /></Field>
          <Field name="email" label="Email" required><Input name="email" type="email" defaultValue={defaultEmail ?? ""} /></Field>
        </FormDialog>
      )}
    </div>
  );
}
