"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ICONS } from "./icons";
import type { QuickAction } from "./quick-actions";

/** Desktop "+ New" — create any record from any page. */
export function NewMenu({ actions }: { actions: QuickAction[] }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button className="hidden lg:inline-flex" />}><Plus /> New</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {actions.map((a) => {
          const Icon = ICONS[a.icon] ?? Plus;
          return <DropdownMenuItem key={a.href} render={<Link href={a.href} />}><Icon /> {a.label}</DropdownMenuItem>;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
