import type { Role } from "@/lib/constants";

/**
 * Capability matrix for UI + server-action checks. The database enforces the
 * same rules through RLS (supabase/migrations/…_rls.sql) — this file only
 * decides what to show and gives friendly errors before hitting the DB.
 */
const MATRIX = {
  "dashboard.view": ["admin", "manager", "team_member"],
  "finance.view": ["admin", "manager"],
  "finance.manage": ["admin", "manager"],
  "finance.delete": ["admin"],
  "profitability.view": ["admin"],
  "leads.view": ["admin", "manager", "team_member"],
  "leads.manage": ["admin", "manager"],
  "leads.delete": ["admin"],
  "clients.view": ["admin", "manager", "team_member"],
  "clients.manage": ["admin", "manager"],
  "clients.delete": ["admin"],
  "pipeline.view": ["admin", "manager"],
  "projects.manage": ["admin", "manager"],
  "projects.delete": ["admin"],
  "tasks.manage": ["admin", "manager"],
  "team.view": ["admin", "manager"],
  "team.manage": ["admin"],
  "reports.view": ["admin", "manager"],
  "settings.manage": ["admin"],
  "files.delete": ["admin", "manager"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof MATRIX;

export function can(role: Role | null | undefined, capability: Capability): boolean {
  return !!role && (MATRIX[capability] as readonly Role[]).includes(role);
}

export const isStaffRole = (role: Role | null | undefined) => role === "admin" || role === "manager" || role === "team_member";
