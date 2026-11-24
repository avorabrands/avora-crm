import type { Capability } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: string; capability?: Capability };
export type NavSection = { label: string; items: NavItem[] };

// icon names map to lucide components in sidebar.tsx (keeps this file server-safe)
export const NAV: NavSection[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" }] },
  {
    label: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: "Target", capability: "leads.view" },
      { href: "/clients", label: "Clients", icon: "Building2", capability: "clients.view" },
      { href: "/pipeline", label: "Sales Pipeline", icon: "KanbanSquare", capability: "pipeline.view" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "/projects", label: "Projects", icon: "FolderKanban" },
      { href: "/tasks", label: "Tasks", icon: "CheckSquare" },
      { href: "/files", label: "Files", icon: "Files" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/quotations", label: "Quotations", icon: "FileText", capability: "finance.view" },
      { href: "/agreements", label: "Agreements", icon: "FileSignature", capability: "finance.view" },
      { href: "/invoices", label: "Invoices", icon: "Receipt", capability: "finance.view" },
      { href: "/payments", label: "Payments", icon: "Wallet", capability: "finance.view" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/team", label: "Team", icon: "Users", capability: "team.view" },
      { href: "/reports", label: "Reports", icon: "BarChart3", capability: "reports.view" },
      { href: "/settings", label: "Settings", icon: "Settings" },
    ],
  },
];
