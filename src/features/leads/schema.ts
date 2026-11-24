import { z } from "zod";
import { LEAD_STATUS, PROJECT_CATEGORY } from "@/lib/constants";
import { zDate, zEmail, zEnum, zMoney, zRequired, zText, zUuid } from "@/lib/actions";

export const leadSchema = z.object({
  company_name: zRequired("Company name"),
  contact_person: zText(120),
  phone: z.preprocess((v) => (v === "" ? null : v), z.string().trim().regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number").nullable().optional()).transform((v) => v ?? null),
  email: zEmail,
  location: zText(200),
  "services[]": z.array(z.string()).optional().default([]),
  source: zText(60),
  estimated_budget: zMoney,
  assigned_to: zUuid,
  status: zEnum(LEAD_STATUS.values, "Status").default("new"),
  next_follow_up: zDate,
  notes: zText(5000),
});

export const activitySchema = z.object({
  type: z.enum(["note", "call", "email", "meeting", "follow_up"]),
  content: zRequired("Details", 5000),
  follow_up_date: zDate,
});

export const convertSchema = z.object({
  create_project: z.preprocess((v) => v === "on", z.boolean()),
  project_name: zText(200),
  category: zEnum(PROJECT_CATEGORY.values, "Category").default("custom"),
  budget: zMoney,
}).refine((v) => !v.create_project || !!v.project_name, { message: "Project name is required", path: ["project_name"] });
