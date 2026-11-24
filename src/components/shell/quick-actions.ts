import { can, type Capability } from "@/lib/auth/permissions";
import type { Role } from "@/lib/constants";

export type QuickAction = { label: string; href: string; icon: string };

const ACTIONS: (QuickAction & { capability?: Capability })[] = [
  { label: "Lead", href: "/leads?new=lead", icon: "Target", capability: "leads.manage" },
  { label: "Task", href: "/tasks?new=task", icon: "CheckSquare" },
  { label: "Client", href: "/clients?new=client", icon: "Building2", capability: "clients.manage" },
  { label: "Project", href: "/projects/new", icon: "FolderKanban", capability: "projects.manage" },
  { label: "Quotation", href: "/quotations/new", icon: "FileText", capability: "finance.manage" },
  { label: "Invoice", href: "/invoices/new", icon: "Receipt", capability: "finance.manage" },
  { label: "Payment", href: "/payments?new=payment", icon: "Wallet", capability: "finance.manage" },
  { label: "Upload files", href: "/files?new=file", icon: "Files" },
];

export const quickActionsFor = (role: Role): QuickAction[] =>
  ACTIONS.filter((a) => !a.capability || can(role, a.capability)).map(({ label, href, icon }) => ({ label, href, icon }));
