import { z } from "zod";
import { CLIENT_STATUS } from "@/lib/constants";
import { zEmail, zEnum, zRequired, zText, zUuid } from "@/lib/actions";

const upper = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().toUpperCase()) : v);

export const clientSchema = z.object({
  company_name: zRequired("Company name"),
  contact_person: zText(120),
  phone: zText(30),
  email: zEmail,
  billing_address: zText(1000),
  state: zText(60),
  gstin: z.preprocess(upper, z.string().regex(/^[0-9]{2}[A-Z0-9]{13}$/, "GSTIN must be 15 characters, e.g. 29ABCDE1234F1Z5").nullable().optional()).transform((v) => v ?? null),
  pan: z.preprocess(upper, z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN looks like ABCDE1234F").nullable().optional()).transform((v) => v ?? null),
  website: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(200).nullable().optional()).transform((v) => (v && !/^https?:\/\//.test(v) ? `https://${v}` : v ?? null)),
  category: zText(60),
  status: zEnum(CLIENT_STATUS.values, "Status").default("active"),
  account_manager_id: zUuid,
  notes: zText(5000),
});

export const portalUserSchema = z.object({
  full_name: zRequired("Name", 120),
  email: z.email("Enter a valid email"),
});
