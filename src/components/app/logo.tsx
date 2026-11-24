import { cn } from "@/lib/utils";

export function Logo({ inverted, compact, className }: { inverted?: boolean; compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">A</div>
      {!compact && (
        <div className="leading-tight">
          <p className={cn("text-sm font-semibold tracking-wide", inverted ? "text-white" : "text-foreground")}>AVORA CRM</p>
          <p className={cn("text-[11px]", inverted ? "text-sidebar-foreground" : "text-muted-foreground")}>Avora Brands</p>
        </div>
      )}
    </div>
  );
}
