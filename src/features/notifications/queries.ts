import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NotificationRow = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

export async function getNotifications(userId: string, limit = 15) {
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase.from("notifications").select("id, type, title, body, link, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  return { items: (data ?? []) as NotificationRow[], unread: count ?? 0 };
}
