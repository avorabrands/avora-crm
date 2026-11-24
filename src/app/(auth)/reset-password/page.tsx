"use client";

import { Input } from "@/components/ui/input";
import { ActionForm, Field, SubmitButton } from "@/components/app/form";
import { updatePassword } from "@/features/auth/actions";

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Use at least 8 characters.</p>
      </div>
      <ActionForm action={updatePassword} className="grid gap-4">
        <Field name="password" label="New password"><Input id="password" name="password" type="password" autoComplete="new-password" /></Field>
        <Field name="confirm" label="Confirm password"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" /></Field>
        <SubmitButton className="w-full">Update password</SubmitButton>
      </ActionForm>
    </div>
  );
}
