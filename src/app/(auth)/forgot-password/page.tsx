"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ActionForm, Field, SubmitButton } from "@/components/app/form";
import { requestPasswordReset } from "@/features/auth/actions";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">We&apos;ll email you a secure link to choose a new password.</p>
      </div>
      <ActionForm action={requestPasswordReset} className="grid gap-4" resetOnSuccess>
        <Field name="email" label="Email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <SubmitButton className="w-full">Send reset link</SubmitButton>
      </ActionForm>
      <Link href="/login" className="block text-center text-xs text-muted-foreground hover:text-foreground">Back to sign in</Link>
    </div>
  );
}
