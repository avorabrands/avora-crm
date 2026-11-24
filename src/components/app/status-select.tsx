"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormActionState } from "./form";

/** Inline select that persists immediately via a server action. */
export function StatusSelect({ value, options, onChange, className, disabled, label = "Status" }: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => Promise<FormActionState>; className?: string; disabled?: boolean; label?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <span className="relative inline-flex items-center">
      <select
        aria-label={label}
        disabled={disabled || pending}
        className={cn("field-select h-7 w-auto pr-7 text-xs", className)}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => {
            const res = await onChange(v);
            if (res.ok) { if (res.message) toast.success(res.message); router.refresh(); }
            else toast.error(res.message ?? "Update failed");
          });
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {pending && <Loader2 className="absolute right-7 size-3 animate-spin text-muted-foreground" />}
    </span>
  );
}
