"use client";

import { useState } from "react";
import { Check, Download, Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/app/form";

/** Approve / request-revision panel for one deliverable. */
export function ReviewBox({ action, fileId, canPreview }: { action: FormAction; fileId: string | null; canPreview: boolean }) {
  const [mode, setMode] = useState<"idle" | "approve" | "revise">("idle");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {fileId && canPreview && <Button variant="outline" size="sm" render={<a href={`/api/files/${fileId}`} target="_blank" rel="noreferrer" />}><Eye /> Preview</Button>}
        {fileId && <Button variant="outline" size="sm" render={<a href={`/api/files/${fileId}?download=1`} />}><Download /> Download</Button>}
        <Button size="sm" variant={mode === "approve" ? "default" : "outline"} onClick={() => setMode("approve")}><Check /> Approve</Button>
        <Button size="sm" variant={mode === "revise" ? "default" : "outline"} onClick={() => setMode("revise")}><RotateCcw /> Request revision</Button>
      </div>
      {mode !== "idle" && (
        <ActionForm action={action} className="grid gap-3 rounded-lg border bg-muted/40 p-3">
          <input type="hidden" name="decision" value={mode === "approve" ? "approved" : "revision_requested"} />
          <Field name="comment" label={mode === "approve" ? "Comments (optional)" : "What should change?"} required={mode === "revise"}>
            <Textarea name="comment" rows={3} placeholder={mode === "approve" ? "Looks great!" : "e.g. Please use the new logo and increase the heading size."} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("idle")}>Cancel</Button>
            <SubmitButton>{mode === "approve" ? "Confirm approval" : "Send revision request"}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

export function QuotationResponse({ action }: { action: FormAction }) {
  const [mode, setMode] = useState<"idle" | "accept" | "reject">("idle");
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button onClick={() => setMode("accept")} variant={mode === "accept" ? "default" : "outline"}><Check /> Accept quotation</Button>
        <Button onClick={() => setMode("reject")} variant={mode === "reject" ? "destructive" : "outline"}>Decline</Button>
      </div>
      {mode !== "idle" && (
        <ActionForm action={action} className="grid gap-3 rounded-lg border bg-muted/40 p-3">
          <input type="hidden" name="decision" value={mode} />
          <Field name="note" label={mode === "accept" ? "Message to Avora (optional)" : "Reason (optional)"}><Textarea name="note" rows={2} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setMode("idle")}>Cancel</Button><SubmitButton variant={mode === "reject" ? "destructive" : "default"}>{mode === "accept" ? "Confirm acceptance" : "Send"}</SubmitButton></div>
        </ActionForm>
      )}
    </div>
  );
}
