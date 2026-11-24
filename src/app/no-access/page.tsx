import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-5 text-center">
        <Logo className="justify-center" />
        <h1 className="text-xl font-semibold">Your account isn&apos;t linked to a workspace yet</h1>
        <p className="text-sm text-muted-foreground">You&apos;re signed in, but an Avora admin hasn&apos;t given you access, or your access was deactivated. Ask your account manager or administrator to add you from Team or the client&apos;s profile.</p>
        <form action={signOut}><Button variant="outline">Sign out</Button></form>
      </div>
    </main>
  );
}
