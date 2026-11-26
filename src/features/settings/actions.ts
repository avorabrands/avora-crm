"use server";

import { revalidatePath } from "next/cache";
import { DOCUMENT_TEMPLATES } from "@/lib/doc-templates";
import { z } from "zod";
import { authorize, authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, formToObject, ok, toActionError, unwrap, zEmail, zRequired, zText, type ActionState } from "@/lib/actions";

const companySchema = z.object({
  company_name: zRequired("Company name"),
  legal_name: zText(200), tagline: zText(200), address: zText(1000), state: zText(60),
  gstin: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : null), z.string().regex(/^[0-9]{2}[A-Z0-9]{13}$/, "Invalid GSTIN").nullable()),
  pan: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : null), z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN").nullable()),
  email: zEmail, phone: zText(30), website: zText(200), bank_details: zText(2000),
});

export async function saveCompany(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("settings.manage");
    const v = companySchema.parse(formToObject(fd));
    const supabase = await createClient();
    unwrap(await supabase.from("company_settings").upsert({ organization_id: s.orgId, ...v }).select("organization_id").single());
    await supabase.from("organizations").update({ name: v.company_name }).eq("id", s.orgId);
    revalidatePath("/", "layout");
    return ok("Company details saved");
  } catch (e) { return toActionError(e); }
}

const taxSchema = z.object({
  tax_rates: z.preprocess((v) => { try { return JSON.parse(String(v)); } catch { return null; } },
    z.array(z.object({ label: z.string().trim().min(1).max(40), rate: z.coerce.number().min(0).max(100) })).min(1, "Keep at least one tax rate").max(20)),
  default_tax_rate: z.coerce.number().min(0).max(100),
  quotation_prefix: z.string().trim().regex(/^[A-Z0-9]{1,8}$/, "1–8 capital letters/digits"),
  invoice_prefix: z.string().trim().regex(/^[A-Z0-9]{1,8}$/, "1–8 capital letters/digits"),
  receipt_prefix: z.string().trim().regex(/^[A-Z0-9]{1,8}$/, "1–8 capital letters/digits"),
  default_payment_terms: zText(2000),
  default_terms: zText(10000),
  quotation_template: z.enum(DOCUMENT_TEMPLATES).catch("classic"),
  invoice_template: z.enum(DOCUMENT_TEMPLATES).catch("classic"),
});

export async function saveBilling(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("settings.manage");
    const v = taxSchema.parse(formToObject(fd));
    if (!v.tax_rates.some((t) => t.rate === v.default_tax_rate)) return fail("The default rate must be one of the configured tax rates.", { default_tax_rate: "Not in the list" });
    const supabase = await createClient();
    unwrap(await supabase.from("company_settings").upsert({ organization_id: s.orgId, ...v }).select("organization_id").single());
    revalidatePath("/settings");
    return ok("Billing & tax settings saved");
  } catch (e) { return toActionError(e); }
}

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorize();
    const v = z.object({ full_name: zRequired("Name", 120), phone: zText(30) }).parse(formToObject(fd));
    const supabase = await createClient();
    unwrap(await supabase.from("profiles").update(v).eq("id", s.userId).select("id").single());
    revalidatePath("/", "layout");
    return ok("Profile updated");
  } catch (e) { return toActionError(e); }
}

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await authorize();
    const v = z.object({ password: z.string().min(8, "Use at least 8 characters"), confirm: z.string() }).refine((x) => x.password === x.confirm, { message: "Passwords don't match", path: ["confirm"] }).parse(formToObject(fd));
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) return fail(error.message);
    return ok("Password changed");
  } catch (e) { return toActionError(e); }
}
