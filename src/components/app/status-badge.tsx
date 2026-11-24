import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  purple: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

type EnumDef = { label: Record<string, string>; tone: Record<string, Tone> };

export function StatusBadge({ def, value, className }: { def: EnumDef; value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <Pill tone={def.tone[value] ?? "neutral"} className={className}>{def.label[value] ?? value}</Pill>;
}

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}
