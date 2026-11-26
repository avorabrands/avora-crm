import { z } from "zod";
import { DOCUMENT_TEMPLATES } from "@/lib/doc-templates";
import { PAYMENT_METHOD, PAYMENT_TYPE, TAX_MODE } from "@/lib/constants";
import { parseAmount } from "@/lib/tax";
import { zDate, zEnum, zRequired, zText, zUuid } from "@/lib/actions";

const amount = (missing: string) => z.preprocess(parseAmount, z.number({ error: missing }));

export const lineItemSchema = z.object({
  name: z.string().trim().min(1, "enter an item name").max(200),
  description: z.string().trim().max(1000).nullish().transform((v) => v || null),
  hsn_sac: z.string().trim().max(20).nullish().transform((v) => v || null),
  quantity: amount("enter a valid quantity").pipe(z.number().positive("quantity must be more than 0").max(1e6, "quantity is too large")),
  unit_price: amount("enter a valid unit price").pipe(z.number().min(0, "price can't be negative").max(1e10, "price is too large")),
  discount_pct: z.preprocess((v) => (String(v ?? "").trim() === "" ? 0 : parseAmount(v)), z.number({ error: "enter a valid discount" }).min(0, "discount must be 0–100%").max(100, "discount must be 0–100%")),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
});

const template = z.enum(DOCUMENT_TEMPLATES).catch("classic");

const items = z.preprocess((v) => { try { return JSON.parse(String(v ?? "[]")); } catch { return []; } },
  z.array(lineItemSchema).min(1, "Add at least one line item").max(200));

export const quotationSchema = z.object({
  client_id: zUuid,
  lead_id: zUuid,
  project_id: zUuid,
  title: zRequired("Title"),
  description: zText(5000),
  issue_date: z.iso.date("Enter a valid date"),
  valid_until: zDate,
  tax_mode: zEnum(TAX_MODE.values, "Tax mode"),
  payment_terms: zText(2000),
  terms: zText(10000),
  notes: zText(5000),
  template,
  items,
}).refine((v) => v.client_id || v.lead_id, { message: "Choose a client", path: ["client_id"] })
  .refine((v) => !v.valid_until || v.valid_until >= v.issue_date, { message: "Validity must be after the issue date", path: ["valid_until"] });

export const invoiceSchema = z.object({
  client_id: z.uuid("Choose a client"),
  project_id: zUuid,
  milestone_id: zUuid,
  invoice_date: z.iso.date("Enter a valid date"),
  due_date: z.iso.date("Enter a valid date"),
  tax_mode: zEnum(TAX_MODE.values, "Tax mode"),
  notes: zText(5000),
  terms: zText(10000),
  template,
  items,
}).refine((v) => v.due_date >= v.invoice_date, { message: "Due date must be on or after the invoice date", path: ["due_date"] });

export const paymentSchema = z.object({
  invoice_id: zUuid,
  client_id: zUuid,
  project_id: zUuid,
  payment_date: z.iso.date("Enter a valid date"),
  amount: z.preprocess((v) => Number(String(v ?? "").replace(/[₹,\s]/g, "")), z.number({ error: "Enter an amount" }).positive("Amount must be more than 0")),
  method: zEnum(PAYMENT_METHOD.values, "Method"),
  payment_type: zEnum(PAYMENT_TYPE.values, "Type"),
  transaction_id: zText(120),
  reference_number: zText(120),
  notes: zText(2000),
}).refine((v) => v.invoice_id || v.client_id, { message: "Choose an invoice or client", path: ["invoice_id"] });

export const agreementSchema = z.object({
  client_id: z.uuid("Choose a client"),
  project_id: zUuid,
  title: zRequired("Title"),
  status: z.enum(["draft", "sent", "signed", "expired", "terminated"]),
  start_date: zDate,
  end_date: zDate,
  signed_date: zDate,
  client_visible: z.preprocess((v) => v === "on", z.boolean()),
  notes: zText(5000),
});
