import "server-only";
import { z } from "zod";
import { AuthError } from "@/lib/auth/session";

export type ActionState<T = unknown> = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
  /** bumps on every response so client effects re-run even for equal messages */
  ts?: number;
};

export const initialState: ActionState = { ok: false };

export const ok = <T,>(message?: string, data?: T): ActionState<T> => ({ ok: true, message, data, ts: Date.now() });
export const fail = (message: string, fieldErrors?: Record<string, string>): ActionState => ({ ok: false, message, fieldErrors, ts: Date.now() });

/** Map thrown errors (auth, zod, postgres) to a user-facing ActionState. */
export function toActionError(e: unknown): ActionState {
  if (e instanceof AuthError) return fail(e.message);
  if (e instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of e.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return fail("Please fix the highlighted fields.", fieldErrors);
  }
  if (isRedirect(e)) throw e;
  const pg = e as { code?: string; message?: string; details?: string };
  if (pg?.code) return fail(pgMessage(pg));
  console.error(e);
  return fail("Something went wrong. Please try again.");
}

function isRedirect(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

export function pgMessage(err: { code?: string; message?: string; details?: string }) {
  switch (err.code) {
    case "23505": return "A record with these details already exists.";
    case "23503": return "This record is linked to other data and can't be changed that way.";
    case "23514": return err.message?.includes("check constraint") ? "Some values are not valid." : (err.message ?? "Invalid value.");
    case "42501": return err.message?.includes("row-level security") ? "You don't have permission to do that." : (err.message ?? "Not allowed.");
    case "22023": case "P0002": return err.message ?? "Invalid request.";
    case "PGRST116": return "Record not found or you don't have access to it.";
    default: return err.message ?? "Database error.";
  }
}

/** Throw on a Supabase error so toActionError can map it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
/** Throw on error or missing row. Rows are loosely typed until `supabase gen types` is wired in. */
export function unwrap<T = Row>(res: { data: unknown; error: { code?: string; message: string } | null }): T {
  if (res.error) throw res.error;
  if (res.data === null || res.data === undefined) throw { code: "PGRST116", message: "Record not found or you don't have access to it." };
  return res.data as T;
}

// ── FormData → typed values ────────────────────────────────────────────
export function formToObject(fd: FormData) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = fd.getAll(key);
    out[key] = key.endsWith("[]") ? all.map(String) : typeof all[0] === "string" ? all[0] : all[0];
  }
  return out;
}

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
export const zText = (max = 500) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional()).transform((v) => v ?? null);
export const zRequired = (label: string, max = 200) => z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);
export const zEmail = z.preprocess(emptyToNull, z.email("Enter a valid email").nullable().optional()).transform((v) => v ?? null);
export const zUuid = z.preprocess(emptyToNull, z.uuid().nullable().optional()).transform((v) => v ?? null);
export const zDate = z.preprocess(emptyToNull, z.iso.date("Enter a valid date").nullable().optional()).transform((v) => v ?? null);
export const zMoney = z.preprocess(
  (v) => (emptyToNull(v) === null ? null : Number(String(v).replace(/[₹,\s]/g, ""))),
  z.number({ error: "Enter a valid amount" }).min(0, "Must be 0 or more").max(1e11).nullable().optional(),
).transform((v) => v ?? null);
export const zBool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
export const zEnum = <T extends readonly [string, ...string[]]>(values: T, label = "Value") =>
  z.enum(values, { error: `Choose a valid ${label.toLowerCase()}` });
