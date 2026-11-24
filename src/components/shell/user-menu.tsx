"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/app/user-avatar";
import { signOut } from "@/features/auth/actions";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

export function UserMenu({ name, email, roleLabel, profileHref }: { name: string; email: string; roleLabel: string; profileHref: string }) {
  return (
    <>
    {/* real form so sign-out works even if the menu unmounts before a click handler runs */}
    <form id="avora-signout" action={signOut} className="hidden" />
    <DropdownMenu>
      <DropdownMenuTrigger render={<button className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-muted" aria-label="Account menu" />}>
        <UserAvatar name={name} className="size-8" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-36 truncate text-sm font-medium">{name}</span>
          <span className="block text-[11px] text-muted-foreground">{roleLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs font-normal">{email}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={profileHref} />}><UserRound /> My profile</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" render={<button type="submit" form="avora-signout" className="w-full" />}><LogOut /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}
