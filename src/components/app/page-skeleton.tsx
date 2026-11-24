import { cn } from "@/lib/utils";

const B = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-md bg-muted-foreground/15", className)} />;
const times = (n: number) => Array.from({ length: n }, (_, i) => i);

function Header({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-2.5"><B className="h-3 w-28 max-w-full" /><B className="h-7 w-48 max-w-full" /><B className="h-3.5 w-72 max-w-full" /></div>
      {action && <B className="h-8 w-28 shrink-0" />}
    </div>
  );
}
function Rows({ n = 8 }: { n?: number }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex gap-2 border-b p-3"><B className="h-8 w-full max-w-64" /><B className="hidden h-8 w-32 sm:block" /><B className="hidden h-8 w-32 md:block" /></div>
      {times(n).map((i) => (
        <div key={i} className="flex items-center gap-6 border-b px-4 py-3.5 last:border-0">
          <div className="flex-1 space-y-2"><B className="h-3.5 w-40 max-w-full" /><B className="h-2.5 w-24" /></div>
          <B className="hidden h-3.5 w-24 sm:block" /><B className="hidden h-5 w-20 rounded-full md:block" /><B className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}
function Card({ lines = 5, className }: { lines?: number; className?: string }) {
  return <div className={cn("space-y-4 rounded-xl border bg-card p-5", className)}><B className="h-4 w-32" />{times(lines).map((i) => <B key={i} className={cn("h-3.5", i % 3 === 2 ? "w-1/2" : "w-full")} />)}</div>;
}
function Stats({ n = 4 }: { n?: number }) {
  return <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{times(n).map((i) => <div key={i} className="space-y-3 rounded-xl border bg-card p-4"><B className="h-3 w-24" /><B className="h-7 w-28" /></div>)}</div>;
}

/** Shown the moment a link is clicked, while the server loads the page's data. */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "detail" | "dashboard" | "form" }) {
  return (
    <div role="status" aria-live="polite" data-page-skeleton={variant}>
      <span className="sr-only">Loading…</span>
      <div aria-hidden>
        <Header action={variant !== "form" && variant !== "dashboard"} />
        {variant === "list" && <Rows />}
        {variant === "dashboard" && <><Stats n={8} /><div className="grid gap-6 xl:grid-cols-3"><Card lines={8} className="xl:col-span-2" /><Card lines={8} /></div></>}
        {variant === "detail" && <><div className="mb-6 flex gap-5 overflow-hidden border-b pb-3">{times(5).map((i) => <B key={i} className="h-4 w-20 shrink-0" />)}</div><Stats /><div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><Card lines={8} /><Card lines={5} /></div></>}
        {variant === "form" && <div className="space-y-6"><Card lines={7} className="max-w-4xl" /><Card lines={4} className="max-w-4xl" /></div>}
      </div>
    </div>
  );
}
