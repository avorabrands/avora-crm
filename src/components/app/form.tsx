"use client";

import { cloneElement, createContext, isValidElement, startTransition, useActionState, useContext, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type FormActionState = { ok: boolean; message?: string; fieldErrors?: Record<string, string>; data?: unknown; ts?: number };
export type FormAction = (prev: FormActionState, formData: FormData) => Promise<FormActionState>;

const FieldErrors = createContext<Record<string, string> | undefined>(undefined);
const FormPending = createContext(false);

export function Field({ name, label, hint, required, children, className }: { name?: string; label: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  const errors = useContext(FieldErrors);
  const uid = useId();
  // nested errors ("items.1.unit_price") surface on their parent field as "Line 2: …"
  const nested = name && errors ? Object.keys(errors).find((k) => k.startsWith(`${name}.`)) : undefined;
  const error = name ? errors?.[name] ?? (nested ? `Line ${Number(nested.split(".")[1]) + 1}: ${errors![nested]}` : undefined) : undefined;
  // link the label to a single form control child (accessible name + click-to-focus)
  const control = isValidElement<{ id?: string; name?: string; "aria-invalid"?: boolean }>(children) && children.props.name ? children : null;
  const controlId = control ? control.props.id ?? `${uid}-${control.props.name}` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)} data-invalid={!!error || undefined}>
      <Label htmlFor={controlId} className="text-xs font-medium">
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
      {control ? cloneElement(control, { id: controlId, "aria-invalid": error ? true : undefined }) : children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return <select className={cn("field-select", className)} {...props}>{children}</select>;
}

export function SubmitButton({ children = "Save", className, variant }: { children?: React.ReactNode; className?: string; variant?: "default" | "destructive" | "outline" }) {
  const status = useFormStatus();
  const pending = useContext(FormPending) || status.pending;
  return (
    <Button type="submit" disabled={pending} className={className} variant={variant}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

/** Wires a server action into a <form>, surfaces toasts and field errors. */
export function ActionForm({ action, children, onSuccess, className, resetOnSuccess = false, successToast = true }: {
  action: FormAction; children: React.ReactNode; onSuccess?: (state: FormActionState) => void; className?: string; resetOnSuccess?: boolean; successToast?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, { ok: false } as FormActionState);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.ts || handled.current === state.ts) return;
    handled.current = state.ts;
    if (state.ok) {
      if (successToast && state.message) toast.success(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      router.refresh();
      onSuccess?.(state);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router, onSuccess, resetOnSuccess, successToast]);

  return (
    <FieldErrors.Provider value={state.ok ? undefined : state.fieldErrors}>
      <FormPending.Provider value={isPending}>
        {/* onSubmit (not action=) so React 19 doesn't auto-reset inputs when validation fails */}
        <form
          ref={formRef}
          className={className}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (isPending) return;
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
        >
          {children}
        </form>
      </FormPending.Provider>
    </FieldErrors.Provider>
  );
}

/** Open state that can also be driven by ?new=<openKey>, so "+ New" works from any page. */
function useUrlOpen(openKey?: string) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [manual, setManual] = useState(false);
  const [key, setKey] = useState(0);
  const fromUrl = !!openKey && params.get("new") === openKey;
  const setOpen = (o: boolean) => {
    setManual(o);
    if (o) setKey((k) => k + 1);
    else if (fromUrl) {
      const next = new URLSearchParams(params.toString());
      next.delete("new");
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  };
  return { open: manual || fromUrl, setOpen, key };
}

/** Modal form: trigger → dialog → server action → toast + close + refresh. */
export function FormDialog({ trigger, title, description, action, children, submitLabel = "Save", size = "md", onSuccess, openKey }: {
  trigger: ReactElement; title: string; description?: string; action: FormAction; children: React.ReactNode; submitLabel?: string; size?: "md" | "lg" | "xl"; onSuccess?: (s: FormActionState) => void; openKey?: string;
}) {
  const { open, setOpen, key } = useUrlOpen(openKey);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className={cn("max-h-[90dvh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-0", size === "md" ? "sm:max-w-lg" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-4xl")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ActionForm key={key} action={action} onSuccess={(s) => { setOpen(false); onSuccess?.(s); }} className="grid gap-4">
          {children}
          <DialogFooter className="max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:mx-0 max-sm:-mb-px max-sm:grid max-sm:grid-cols-2 max-sm:border-t max-sm:bg-popover max-sm:px-0 max-sm:py-3 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>{submitLabel}</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

/** Same as FormDialog but as a right-hand sheet for longer forms. */
export function FormSheet({ trigger, title, description, action, children, submitLabel = "Save", onSuccess, openKey }: {
  trigger: ReactElement; title: string; description?: string; action: FormAction; children: React.ReactNode; submitLabel?: string; onSuccess?: (s: FormActionState) => void; openKey?: string;
}) {
  const { open, setOpen, key } = useUrlOpen(openKey);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <ActionForm key={key} action={action} onSuccess={(s) => { setOpen(false); onSuccess?.(s); }} className="grid gap-4 px-4">
          {children}
          <div className="sticky bottom-0 z-10 -mx-4 grid grid-cols-2 gap-2 border-t bg-popover px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>{submitLabel}</SubmitButton>
          </div>
        </ActionForm>
      </SheetContent>
    </Sheet>
  );
}
