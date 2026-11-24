"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintBar({ back }: { back: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between print:hidden">
      <a href={back} className="text-sm text-muted-foreground hover:text-foreground">← Back</a>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
        <Button onClick={() => window.print()}><Download /> Save as PDF</Button>
      </div>
    </div>
  );
}
