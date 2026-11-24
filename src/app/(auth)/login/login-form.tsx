"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/app/password-input";
import { ActionForm, Field, SubmitButton } from "@/components/app/form";
import { signIn } from "@/features/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@avorabrands.com" />
      </Field>
      <Field name="password" label="Password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
      </div>
      <SubmitButton className="w-full">Sign in</SubmitButton>
    </ActionForm>
  );
}
