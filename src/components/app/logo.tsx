import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ inverted, compact, className }: { inverted?: boolean; compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image src="/avora-logo.png" alt={compact ? "Avora Brands" : ""} width={36} height={36} priority className="size-9 shrink-0 rounded-lg" />
      {!compact && <p className={cn("text-sm font-semibold tracking-wide", inverted ? "text-white" : "text-foreground")}>Avora Brands</p>}
    </div>
  );
}
