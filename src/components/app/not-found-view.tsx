import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared "not found" body: the record was deleted, never existed, or isn't shared with you. */
export function NotFoundView({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <SearchX className="size-5" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">We couldn&apos;t find that</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          It may have been deleted, the link may be wrong, or it hasn&apos;t been shared with your account.
        </p>
      </div>
      <Button render={<Link href={homeHref} />}>{homeLabel}</Button>
    </div>
  );
}
