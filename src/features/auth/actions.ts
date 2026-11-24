"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionState } from "@/lib/actions";

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail("Please check your details.", Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return fail(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
  const next = parsed.data.next;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = z.email().safeParse(fd.get("email"));
  if (!email.success) return fail("Enter a valid email", { email: "Enter a valid email" });
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  if (error) return fail(error.message);
  // Same response whether or not the account exists (no user enumeration).
  return ok("If an account exists for that email, Supabase has sent a reset link.");
}

export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const schema = z.object({ password: z.string().min(8, "Use at least 8 characters"), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail("Please check the form.", Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message);
  redirect("/");
}
