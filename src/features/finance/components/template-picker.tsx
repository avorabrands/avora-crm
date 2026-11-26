"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { DOCUMENT_TEMPLATES, TEMPLATE_INFO, type DocTemplate } from "@/lib/doc-templates";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; message?: string };

/** Miniature of each layout so the choice is visual, not just a name. */
export function TemplateThumb({ template, className }: { template: DocTemplate; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block h-9 w-7 shrink-0 overflow-hidden rounded-[3px] border bg-white shadow-xs", className)}>
      {template === "classic" && <><span className="absolute top-1 left-1 h-1 w-2.5 rounded-sm bg-[#7047EB]" /><span className="absolute top-1 right-1 h-1 w-1.5 rounded-sm bg-slate-300" /><span className="absolute inset-x-1 top-3 h-px bg-slate-200" /><span className="absolute inset-x-1 top-4.5 h-1 rounded-sm bg-slate-100" /><span className="absolute inset-x-1 top-6 h-px bg-slate-200" /><span className="absolute right-1 bottom-1 h-1 w-2.5 rounded-sm bg-slate-300" /></>}
      {template === "modern" && <><span className="absolute inset-x-0 top-0 h-2.5 bg-gradient-to-br from-[#7047EB] to-[#4F2BC7]" /><span className="absolute inset-x-1 top-3.5 h-1 rounded-sm bg-[#7047EB]/80" /><span className="absolute inset-x-1 top-5 h-1 rounded-sm bg-slate-100" /><span className="absolute right-1 bottom-1 h-1.5 w-3.5 rounded-sm bg-[#7047EB]" /></>}
      {template === "professional" && <><span className="absolute inset-0.5 border border-slate-600" /><span className="absolute inset-x-0.5 top-0.5 h-1.5 border-b border-slate-600 bg-slate-200" /><span className="absolute inset-x-0.5 top-3.5 h-px bg-slate-500" /><span className="absolute top-3.5 bottom-0.5 left-3 w-px bg-slate-400" /><span className="absolute inset-x-0.5 top-6 h-px bg-slate-500" /></>}
    </span>
  );
}

/**
 * Pick a layout. With `save` it persists the choice on the document (staff);
 * with `onPreview` it only switches what is shown (e.g. the client's print view).
 */
export function TemplatePicker({ value, save, onPreview, className, compact }: {
  value: DocTemplate; save?: (t: DocTemplate) => Promise<Result>; onPreview?: (t: DocTemplate) => void; className?: string; compact?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [busy, setBusy] = useState<DocTemplate | null>(null);
  const [, start] = useTransition();
  const choose = (t: DocTemplate) => {
    if (t === current || busy) return;
    if (!save) { setCurrent(t); onPreview?.(t); return; }
    const prev = current;
    setCurrent(t); setBusy(t);
    start(async () => {
      const r = await save(t);
      setBusy(null);
      if (r.ok) { toast.success(`${TEMPLATE_INFO[t].label} template applied`); router.refresh(); }
      else { setCurrent(prev); toast.error(r.message ?? "Couldn't change the template"); }
    });
  };
  return (
    <div role="radiogroup" aria-label="Document template" className={cn("flex flex-wrap items-center gap-1.5 max-sm:grid max-sm:grid-cols-3 print:hidden", className)}>
      {!compact && <span className="mr-1 text-xs font-medium text-muted-foreground max-sm:hidden">Template</span>}
      {DOCUMENT_TEMPLATES.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={current === t} title={TEMPLATE_INFO[t].description} onClick={() => choose(t)}
          className={cn("flex min-h-9 items-center gap-2 rounded-lg border bg-background py-1 pr-3 pl-1 text-sm transition-colors hover:bg-muted max-sm:justify-center max-sm:gap-1.5 max-sm:px-1 max-sm:text-xs",
            current === t && "border-primary bg-primary/5 font-medium text-primary ring-1 ring-primary")}>
          {busy === t ? <span className="flex h-9 w-7 items-center justify-center"><Loader2 className="size-4 animate-spin" /></span> : <TemplateThumb template={t} />}
          {TEMPLATE_INFO[t].label}
        </button>
      ))}
    </div>
  );
}

/** Same picker for forms: posts the value as `name`. */
export function TemplateField({ name = "template", defaultValue }: { name?: string; defaultValue: DocTemplate }) {
  const [v, setV] = useState(defaultValue);
  return (
    <div role="radiogroup" aria-label="Template" className="grid gap-2 sm:grid-cols-3">
      <input type="hidden" name={name} value={v} />
      {DOCUMENT_TEMPLATES.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={v === t} onClick={() => setV(t)}
          className={cn("flex items-center gap-3 rounded-lg border bg-background p-2 text-left transition-colors hover:bg-muted",
            v === t && "border-primary bg-primary/5 ring-1 ring-primary")}>
          <TemplateThumb template={t} className="h-12 w-9" />
          <span className="min-w-0"><span className={cn("block text-sm font-medium", v === t && "text-primary")}>{TEMPLATE_INFO[t].label}</span><span className="block text-xs text-muted-foreground">{TEMPLATE_INFO[t].description}</span></span>
        </button>
      ))}
    </div>
  );
}
