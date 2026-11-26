"use client";

import { usePathname, useRouter } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplatePicker } from "@/features/finance/components/template-picker";
import type { DocTemplate } from "@/lib/doc-templates";

type Result = { ok: boolean; message?: string };

/** Back link, template switcher (quotations / invoices) and print buttons. Hidden when printing. */
export function PrintBar({ back, template, save }: { back: string; template?: DocTemplate; save?: (t: DocTemplate) => Promise<Result> }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden">
      <a href={back} className="text-sm text-muted-foreground hover:text-foreground">← Back</a>
      {template && (
        <TemplatePicker key={template} value={template} save={save} className="order-last w-full sm:order-none sm:w-auto"
          onPreview={(t) => router.replace(`${pathname}?template=${t}`, { scroll: false })} />
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
        <Button onClick={() => window.print()}><Download /> Save as PDF</Button>
      </div>
    </div>
  );
}
