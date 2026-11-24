import { requireSession } from "@/lib/auth/session";

/** Standalone, chrome-free document pages for printing / "Save as PDF". RLS decides what each user can open. */
export default async function PrintLayout({ children }: LayoutProps<"/">) {
  await requireSession();
  return <div className="min-h-screen bg-muted/40 p-3 sm:p-6 print:bg-white print:p-0">{children}</div>;
}
