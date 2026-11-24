"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import type { NotificationRow } from "@/features/notifications/queries";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationBell({ items, unread, portal = false }: { items: NotificationRow[]; unread: number; portal?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`} />}>
        <Bell />
        {unread > 0 && <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="xs" disabled={pending} onClick={() => start(async () => { await markAllNotificationsRead(); router.refresh(); })}>
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : items.map((n) => {
            const href = n.link ? (portal && !n.link.startsWith("/portal") ? "/portal" : n.link) : undefined;
            const content = (
              <div className={cn("flex gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60", !n.read_at && "bg-accent/40")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm leading-snug font-medium">{n.title}</p>
                  {n.body && <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</p>
                </div>
              </div>
            );
            const onClick = () => { if (!n.read_at) start(async () => { await markNotificationRead(n.id); router.refresh(); }); };
            return href ? <Link key={n.id} href={href} onClick={onClick} className="block">{content}</Link> : <button key={n.id} onClick={onClick} className="block w-full">{content}</button>;
          })}
        </div>
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">In-app only. Email/WhatsApp delivery is not configured.</p>
      </PopoverContent>
    </Popover>
  );
}
