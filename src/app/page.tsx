import { redirect } from "next/navigation";
import { homeFor, requireSession } from "@/lib/auth/session";

/** Role-based landing: staff → dashboard, clients → portal, leads → their quotations. */
export default async function Home() {
  const session = await requireSession();
  redirect(homeFor(session.role));
}
