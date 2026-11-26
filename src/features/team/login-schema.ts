import { z } from "zod";

/** "How will they sign in?" — shared by team, client and lead login forms. */
export const passwordSchema = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");

const loginSchema = z.discriminatedUnion("login_method", [
  z.object({ login_method: z.literal("password"), password: passwordSchema }),
  z.object({ login_method: z.literal("invite"), password: z.any().optional() }),
]);

export function parseLogin(fd: FormData) {
  const password = fd.get("password");
  const v = loginSchema.parse({ login_method: fd.get("login_method") === "password" ? "password" : "invite", password: typeof password === "string" ? password : undefined });
  return { method: v.login_method, password: v.login_method === "password" ? (v.password as string) : null };
}
