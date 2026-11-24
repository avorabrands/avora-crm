import { Logo } from "@/components/app/logo";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-xl space-y-5">
        <Logo />
        <h1 className="text-xl font-semibold">Connect Supabase to finish setup</h1>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Create a Supabase project and run the SQL files in <code>supabase/migrations</code> (in order) in the SQL editor.</li>
          <li>Copy <code>.env.example</code> to <code>.env.local</code> and fill in your project URL, anon key and service-role key.</li>
          <li>Run <code>npm run seed</code> to create the organisation, test users and sample data, then restart <code>npm run dev</code>.</li>
        </ol>
        <p className="text-sm text-muted-foreground">Full guide: <code>docs/SUPABASE.md</code></p>
      </div>
    </main>
  );
}
