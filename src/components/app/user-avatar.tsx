import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const COLORS = ["bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-teal-100 text-teal-700", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700", "bg-slate-200 text-slate-700"];

export function UserAvatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const n = name || "?";
  const color = COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span title={n} className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", color, className)}>
      {initials(n)}
    </span>
  );
}

export function PersonCell({ name, sub }: { name: string | null | undefined; sub?: string | null }) {
  if (!name) return <span className="text-muted-foreground">Unassigned</span>;
  return (
    <span className="flex items-center gap-2">
      <UserAvatar name={name} className="size-6 text-[10px]" />
      <span className="min-w-0">
        <span className="block truncate">{name}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </span>
  );
}
