import { z } from "zod";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { zDate, zEnum, zRequired, zText, zUuid } from "@/lib/actions";

export const taskSchema = z.object({
  title: zRequired("Title"),
  project_id: z.uuid("Choose a project"),
  deliverable_id: zUuid,
  description: zText(10000),
  assigned_to: zUuid,
  priority: zEnum(PRIORITY.values, "Priority").default("medium"),
  start_date: zDate,
  due_date: zDate,
  status: zEnum(TASK_STATUS.values, "Status").default("todo"),
}).refine((v) => !v.start_date || !v.due_date || v.due_date >= v.start_date, { message: "Due date must be after the start date", path: ["due_date"] });
