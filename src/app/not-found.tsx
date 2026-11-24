import { Logo } from "@/components/app/logo";
import { NotFoundView } from "@/components/app/not-found-view";

export default function NotFound() {
  return (
    <main className="min-h-screen p-6">
      <Logo />
      <NotFoundView homeHref="/" homeLabel="Go to AVORA CRM" />
    </main>
  );
}
