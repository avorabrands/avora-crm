"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPendingLine } from "@/components/app/nav-feedback";
import { cn } from "@/lib/utils";

const ITEMS = [
  ["/portal", "Dashboard"], ["/portal/projects", "My projects"], ["/portal/deliverables", "Deliverables"], ["/portal/approvals", "Approvals"],
  ["/portal/files", "Files"], ["/portal/quotations", "Quotations"], ["/portal/invoices", "Invoices"], ["/portal/payments", "Payments"], ["/portal/profile", "Profile"],
] as const;

export function PortalNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
      {ITEMS.map(([href, label]) => {
        const active = href === "/portal" ? path === href : path.startsWith(href);
        return <Link key={href} href={href} className={cn("relative -mb-px border-b-2 border-transparent px-3 py-2.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground", active && "border-primary font-medium text-foreground")}>{label}<LinkPendingLine /></Link>;
      })}
    </nav>
  );
}
