"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Mail, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormDialog } from "@/components/app/form";
import { PasswordInput } from "@/components/app/password-input";
import { cn } from "@/lib/utils";
import { setMemberPassword } from "./actions";

/** 12 characters from an unambiguous alphabet (no 0/O, 1/l/I), always with a digit. */
export function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  let out = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  if (!/\d/.test(out)) out = out.slice(0, -1) + "7";
  return out;
}

/** Password box with Generate and Copy-sign-in-details buttons. */
function PasswordWithTools({ name = "password", email: fixedEmail }: { name?: string; email?: string | null }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const copy = async () => {
    if (!value) { toast.error("Type or generate a password first."); return; }
    const email = fixedEmail ?? (ref.current?.closest("form")?.querySelector<HTMLInputElement>('input[name="email"]')?.value ?? "").trim();
    const text = [`Sign in at ${location.origin}/login`, email && `Email: ${email}`, `Password: ${value}`].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); toast.success("Sign-in details copied — paste them into WhatsApp or email."); }
    catch { toast.error("Couldn't copy — select the password and copy it manually."); }
  };
  return (
    <div ref={ref} className="grid gap-2">
      <PasswordInput name={name} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setValue(generatePassword())}><Wand2 /> Generate</Button>
        <Button type="button" variant="outline" size="sm" onClick={copy}><Copy /> Copy sign-in details</Button>
      </div>
    </div>
  );
}

/** "How will they sign in?" — set a password now, or email an invite link. Posts login_method + password. */
export function LoginFields({ className }: { className?: string }) {
  const [method, setMethod] = useState<"password" | "invite">("password");
  const opt = (value: "password" | "invite", Icon: typeof KeyRound, title: string, sub: string) => (
    <button type="button" role="radio" aria-checked={method === value} onClick={() => setMethod(value)}
      className={cn("flex items-start gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted", method === value && "border-primary bg-primary/5 ring-1 ring-primary")}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", method === value ? "text-primary" : "text-muted-foreground")} />
      <span><span className={cn("block text-sm font-medium", method === value && "text-primary")}>{title}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
    </button>
  );
  return (
    <div className={cn("grid gap-3", className)}>
      <input type="hidden" name="login_method" value={method} />
      <div role="radiogroup" aria-label="How will they sign in?" className="grid gap-2 sm:grid-cols-2">
        {opt("password", KeyRound, "Set a password now", "Ready immediately — you share the details")}
        {opt("invite", Mail, "Send an invite email", "They choose their own password")}
      </div>
      {method === "password" ? (
        <Field name="password" label="Password" required hint="Passwords aren't stored in the CRM and can't be viewed later — copy them before saving.">
          <PasswordWithTools />
        </Field>
      ) : (
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">Supabase emails them a link to set a password. Make sure email (SMTP) is set up in Supabase, or use “Set a password now”.</p>
      )}
    </div>
  );
}

/** Owner/admin: set a new password for any sign-in. */
export function SetPasswordButton({ memberId, name, email, trigger }: { memberId: string; name?: string | null; email?: string | null; trigger?: React.ReactElement }) {
  return (
    <FormDialog
      trigger={trigger ?? <Button variant="ghost" size="sm" className="text-xs"><KeyRound /> Set password</Button>}
      title={`Set a new password${name ? ` for ${name}` : ""}`}
      description="Their old password stops working immediately. Copy the new one and share it with them securely."
      action={setMemberPassword.bind(null, memberId)}
      submitLabel="Set password"
    >
      <Field name="password" label="New password" required><PasswordWithTools email={email} /></Field>
    </FormDialog>
  );
}
