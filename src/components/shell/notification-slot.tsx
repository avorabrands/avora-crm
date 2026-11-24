import { Suspense } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNotifications } from "@/features/notifications/queries";
import { NotificationBell } from "./notification-bell";

async function Loaded({ userId, portal }: { userId: string; portal?: boolean }) {
  const { items, unread } = await getNotifications(userId);
  return <NotificationBell items={items} unread={unread} portal={portal} />;
}

/** Streams in, so the page frame never waits for the notification queries. */
export function NotificationSlot(props: { userId: string; portal?: boolean }) {
  return (
    <Suspense fallback={<Button variant="ghost" size="icon" disabled aria-label="Loading notifications"><Bell /></Button>}>
      <Loaded {...props} />
    </Suspense>
  );
}
