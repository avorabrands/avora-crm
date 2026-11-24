"use client";

import { Textarea } from "@/components/ui/textarea";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/app/form";

export function CommentComposer({ action }: { action: FormAction }) {
  return (
    <ActionForm action={action} resetOnSuccess successToast={false} className="grid gap-2">
      <Field name="body" label="Add a comment"><Textarea name="body" rows={3} placeholder="Share progress, questions or feedback…" /></Field>
      <div className="flex justify-end"><SubmitButton>Comment</SubmitButton></div>
    </ActionForm>
  );
}
