"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "./confirm";
import { FormSheet, FormDialog, type FormAction, type FormActionState } from "./form";

/** Standard edit (sheet/dialog) + delete (confirm) icon buttons for table rows. */
export function RowActions({ editTitle, edit, editForm, editAs = "sheet", deleteTitle, deleteDescription, onDelete, children }: {
  editTitle?: string; edit?: FormAction; editForm?: React.ReactNode; editAs?: "sheet" | "dialog";
  deleteTitle?: string; deleteDescription?: string; onDelete?: () => Promise<FormActionState>; children?: React.ReactNode;
}) {
  const trigger = <Button variant="ghost" size="icon-sm" aria-label="Edit"><Pencil /></Button>;
  return (
    <div className="flex items-center justify-end gap-0.5">
      {children}
      {edit && editForm && (editAs === "sheet"
        ? <FormSheet trigger={trigger} title={editTitle ?? "Edit"} action={edit}>{editForm}</FormSheet>
        : <FormDialog trigger={trigger} title={editTitle ?? "Edit"} action={edit}>{editForm}</FormDialog>)}
      {onDelete && (
        <ConfirmAction
          trigger={<Button variant="ghost" size="icon-sm" aria-label="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>}
          title={deleteTitle ?? "Delete this record?"}
          description={deleteDescription ?? "This cannot be undone."}
          action={onDelete}
        />
      )}
    </div>
  );
}
