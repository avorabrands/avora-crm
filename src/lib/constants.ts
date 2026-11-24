// Single source of truth for enum values (mirrors supabase/migrations/…_schema.sql)
export type Tone = "neutral" | "purple" | "blue" | "green" | "amber" | "red" | "slate" | "teal";

function def<T extends string>(entries: [T, string, Tone][]) {
  return {
    values: entries.map((e) => e[0]) as [T, ...T[]],
    label: Object.fromEntries(entries.map((e) => [e[0], e[1]])) as Record<T, string>,
    tone: Object.fromEntries(entries.map((e) => [e[0], e[2]])) as Record<T, Tone>,
    options: entries.map(([value, label]) => ({ value, label })),
  };
}

export const ROLES = def([
  ["admin", "Admin / Owner", "purple"],
  ["manager", "Manager", "blue"],
  ["team_member", "Team member", "teal"],
  ["client", "Client", "slate"],
] as const satisfies [string, string, Tone][]);
export type Role = (typeof ROLES.values)[number];

export const LEAD_STATUS = def([
  ["new", "New lead", "slate"],
  ["contacted", "Contacted", "blue"],
  ["discussion", "Discussion", "teal"],
  ["requirement_received", "Requirement received", "purple"],
  ["quotation_sent", "Quotation sent", "amber"],
  ["negotiation", "Negotiation", "amber"],
  ["won", "Won", "green"],
  ["lost", "Lost", "red"],
] as const satisfies [string, string, Tone][]);
export type LeadStatus = (typeof LEAD_STATUS.values)[number];

export const OPPORTUNITY_STAGE = def([
  ["new", "New lead", "slate"],
  ["discussion", "Discussion", "teal"],
  ["quotation_sent", "Quotation sent", "amber"],
  ["negotiation", "Negotiation", "purple"],
  ["won", "Won", "green"],
  ["lost", "Lost", "red"],
] as const satisfies [string, string, Tone][]);
export type OpportunityStage = (typeof OPPORTUNITY_STAGE.values)[number];

export const CLIENT_STATUS = def([
  ["active", "Active", "green"],
  ["on_hold", "On hold", "amber"],
  ["inactive", "Inactive", "slate"],
] as const satisfies [string, string, Tone][]);

export const PROJECT_CATEGORY = def([
  ["brand_identity", "Brand Identity", "purple"],
  ["graphic_design", "Graphic Design", "blue"],
  ["ui_ux", "UI/UX Design", "teal"],
  ["website", "Website Design & Development", "blue"],
  ["social_media", "Social Media Branding", "purple"],
  ["digital_marketing", "Digital Marketing", "amber"],
  ["print", "Print Solutions", "slate"],
  ["custom", "Custom Project", "neutral"],
] as const satisfies [string, string, Tone][]);

export const PROJECT_STATUS = def([
  ["not_started", "Not started", "slate"],
  ["in_progress", "In progress", "blue"],
  ["internal_review", "Internal review", "purple"],
  ["client_review", "Client review", "teal"],
  ["revision_required", "Revision required", "amber"],
  ["approved", "Approved", "green"],
  ["completed", "Completed", "green"],
  ["on_hold", "On hold", "amber"],
  ["cancelled", "Cancelled", "red"],
] as const satisfies [string, string, Tone][]);
export type ProjectStatus = (typeof PROJECT_STATUS.values)[number];
export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["not_started", "in_progress", "internal_review", "client_review", "revision_required", "approved"];

export const PRIORITY = def([
  ["low", "Low", "slate"],
  ["medium", "Medium", "blue"],
  ["high", "High", "amber"],
  ["urgent", "Urgent", "red"],
] as const satisfies [string, string, Tone][]);

export const TASK_STATUS = def([
  ["todo", "To do", "slate"],
  ["in_progress", "In progress", "blue"],
  ["internal_review", "Internal review", "purple"],
  ["client_review", "Client review", "teal"],
  ["revision", "Revision", "amber"],
  ["approved", "Approved", "green"],
  ["completed", "Completed", "green"],
] as const satisfies [string, string, Tone][]);
export type TaskStatus = (typeof TASK_STATUS.values)[number];
export const OPEN_TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "internal_review", "client_review", "revision"];

export const DESIGN_STATUS = def([
  ["not_started", "Not started", "slate"],
  ["in_progress", "In progress", "blue"],
  ["completed", "Completed", "green"],
] as const satisfies [string, string, Tone][]);

export const REVIEW_STATUS = def([
  ["not_started", "—", "neutral"],
  ["pending", "Pending", "amber"],
  ["approved", "Approved", "green"],
  ["changes_requested", "Changes requested", "red"],
] as const satisfies [string, string, Tone][]);

export const APPROVAL_STATUS = def([
  ["pending", "Pending", "slate"],
  ["approved", "Approved", "green"],
  ["revision_requested", "Revision requested", "amber"],
] as const satisfies [string, string, Tone][]);

export const MILESTONE_STATUS = def([
  ["pending", "Pending", "slate"],
  ["in_progress", "In progress", "blue"],
  ["completed", "Completed", "green"],
] as const satisfies [string, string, Tone][]);

export const QUOTATION_STATUS = def([
  ["draft", "Draft", "slate"],
  ["sent", "Sent", "blue"],
  ["viewed", "Viewed", "teal"],
  ["accepted", "Accepted", "green"],
  ["rejected", "Rejected", "red"],
  ["expired", "Expired", "amber"],
] as const satisfies [string, string, Tone][]);

// "overdue" is derived (unpaid/partial and past due date), never stored
export const INVOICE_STATUS = def([
  ["draft", "Draft", "slate"],
  ["unpaid", "Unpaid", "blue"],
  ["partially_paid", "Partially paid", "amber"],
  ["paid", "Paid", "green"],
  ["overdue", "Overdue", "red"],
  ["cancelled", "Cancelled", "neutral"],
] as const satisfies [string, string, Tone][]);
export type InvoiceStatus = (typeof INVOICE_STATUS.values)[number];

export const TAX_MODE = def([
  ["intra_state", "CGST + SGST (same state)", "neutral"],
  ["inter_state", "IGST (other state)", "neutral"],
  ["none", "No tax", "neutral"],
] as const satisfies [string, string, Tone][]);

export const PAYMENT_METHOD = def([
  ["bank_transfer", "Bank transfer", "neutral"],
  ["upi", "UPI", "neutral"],
  ["cash", "Cash", "neutral"],
  ["cheque", "Cheque", "neutral"],
  ["card", "Card", "neutral"],
  ["other", "Other", "neutral"],
] as const satisfies [string, string, Tone][]);

export const PAYMENT_TYPE = def([
  ["advance", "Advance", "purple"],
  ["milestone", "Milestone", "blue"],
  ["partial", "Partial", "amber"],
  ["final", "Final", "green"],
] as const satisfies [string, string, Tone][]);

export const AGREEMENT_STATUS = def([
  ["draft", "Draft", "slate"],
  ["sent", "Sent", "blue"],
  ["signed", "Signed", "green"],
  ["expired", "Expired", "amber"],
  ["terminated", "Terminated", "red"],
] as const satisfies [string, string, Tone][]);

export const FILE_CATEGORY = def([
  ["document", "Document", "slate"],
  ["image", "Image", "blue"],
  ["design", "Design file", "purple"],
  ["agreement", "Agreement", "teal"],
  ["invoice", "Invoice", "amber"],
  ["quotation", "Quotation", "amber"],
  ["deliverable", "Final deliverable", "green"],
  ["other", "Other", "neutral"],
] as const satisfies [string, string, Tone][]);

export const LEAD_SOURCES = ["Referral", "Website", "Instagram", "LinkedIn", "Google Ads", "Walk-in", "Cold outreach", "Event", "Other"];
export const SERVICES = ["Brand Identity", "Graphic Design", "UI/UX Design", "Website", "Social Media", "Digital Marketing", "Print", "Packaging", "Video"];
export const CLIENT_CATEGORIES = ["Education", "Healthcare", "Real Estate", "Retail", "Hospitality", "Technology", "Manufacturing", "Non-profit", "Other"];
export const INDIAN_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
