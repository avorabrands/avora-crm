import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";

/** Role-based landing: staff → dashboard, clients → portal. */
export default async function Home() {
  const session = await requireSession();
  redirect(session.role === "client" ? "/portal" : "/dashboard");
}
