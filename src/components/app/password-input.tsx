"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password box with a show/hide eye. Hides itself again on submit so browsers still save it as a password. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = wrap.current?.closest("form");
    const hide = () => setVisible(false);
    form?.addEventListener("submit", hide);
    return () => form?.removeEventListener("submit", hide);
  }, []);

  const Icon = visible ? EyeOff : Eye;
  return (
    <div ref={wrap} className="relative">
      <Input {...props} type={visible ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={cn("pr-11", className)} />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={props.id}
        onMouseDown={(e) => e.preventDefault()} // keep the cursor in the box
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Icon className="size-4" />
      </button>
    </div>
  );
}
