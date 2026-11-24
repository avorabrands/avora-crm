"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionForm, SubmitButton, type FormAction } from "@/components/app/form";

export function NewProjectForm({ action, children }: { action: FormAction; children: React.ReactNode }) {
  return (
    <ActionForm action={action} className="grid gap-6">
      {children}
      <div className="flex justify-end gap-2">
        <Button variant="outline" render={<Link href="/projects" />}>Cancel</Button>
        <SubmitButton>Create project</SubmitButton>
      </div>
    </ActionForm>
  );
}
