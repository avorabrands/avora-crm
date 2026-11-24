"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { FormActionState } from "./form";

type RunAction = () => Promise<FormActionState>;

function useRun(action: RunAction, after?: (s: FormActionState) => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (onDone?: () => void) =>
    start(async () => {
      const res = await action();
      if (res.ok) {
        if (res.message) toast.success(res.message);
        router.refresh();
        after?.(res);
      } else toast.error(res.message ?? "Something went wrong");
      onDone?.();
    });
  return { run, pending };
}

/** Destructive / important action behind a confirmation dialog. */
export function ConfirmAction({ trigger, title, description, confirmLabel = "Delete", destructive = true, action, onDone }: {
  trigger: ReactElement; title: string; description: string; confirmLabel?: string; destructive?: boolean; action: RunAction; onDone?: (s: FormActionState) => void;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useRun(action, onDone);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} disabled={pending} onClick={() => run(() => setOpen(false))}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Wrap any clickable element to run a server action with toast feedback. */
export function ActionTrigger({ action, children, className, disabled }: { action: RunAction; children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { run, pending } = useRun(action);
  return (
    <button type="button" className={className} disabled={disabled || pending} onClick={() => run()}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
