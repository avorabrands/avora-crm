"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ok, toActionError } from "@/lib/actions";

export async function markNotificationRead(id: string) {
  try {
    const s = await authorize();
    const supabase = await createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", s.userId);
    return ok();
  } catch (e) { return toActionError(e); }
}

export async function markAllNotificationsRead() {
  try {
    const s = await authorize();
    const supabase = await createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", s.userId).is("read_at", null);
    revalidatePath("/", "layout");
    return ok("All caught up");
  } catch (e) { return toActionError(e); }
}
