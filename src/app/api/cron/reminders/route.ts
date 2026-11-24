import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

/**
 * Daily reminders (follow-ups due, deadlines approaching, overdue tasks & invoices,
 * expiring quotations). Call from Vercel Cron with `Authorization: Bearer $CRON_SECRET`,
 * or schedule public.generate_due_reminders() with pg_cron instead (docs/SUPABASE.md).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminClientConfigured()) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });
  const { data, error } = await createAdminClient().rpc("generate_due_reminders");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notificationsCreated: data });
}
