import { z } from "zod";
import { MILESTONE_STATUS, PRIORITY, PROJECT_CATEGORY, PROJECT_STATUS } from "@/lib/constants";
import { zBool, zDate, zEnum, zMoney, zRequired, zText, zUuid } from "@/lib/actions";

export const projectSchema = z.object({
  name: zRequired("Project name"),
  client_id: z.uuid("Choose a client"),
  category: zEnum(PROJECT_CATEGORY.values, "Category"),
  description: zText(5000),
  start_date: zDate,
  due_date: zDate,
  budget: zMoney,
  manager_id: zUuid,
  priority: zEnum(PRIORITY.values, "Priority").default("medium"),
  status: zEnum(PROJECT_STATUS.values, "Status").default("not_started"),
  progress_mode: z.enum(["auto", "manual"]).default("auto"),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  client_visible: zBool,
  "member_ids[]": z.array(z.uuid()).optional().default([]),
}).refine((v) => !v.start_date || !v.due_date || v.due_date >= v.start_date, { message: "Delivery date must be after the start date", path: ["due_date"] });

export const milestoneSchema = z.object({
  title: zRequired("Title"),
  description: zText(2000),
  due_date: zDate,
  amount: zMoney,
  status: zEnum(MILESTONE_STATUS.values, "Status").default("pending"),
  client_visible: zBool,
});

export const financialsSchema = z.object({
  estimated_cost: zMoney,
  actual_cost: zMoney,
  notes: zText(2000),
});
