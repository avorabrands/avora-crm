"use client";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, NativeSelect } from "@/components/app/form";
import { FILE_CATEGORY } from "@/lib/constants";
import type { Option } from "@/features/common/lookups";
import { uploadFiles } from "../actions";

export function FileUploadDialog({ projectId, clientId, taskId, projects, defaultFolder = "General", allowShare = true, label = "Upload files" }: {
  projectId?: string; clientId?: string; taskId?: string; projects?: Option[]; defaultFolder?: string; allowShare?: boolean; label?: string;
}) {
  return (
    <FormDialog openKey={projectId || clientId ? undefined : "file"} trigger={<Button><Upload /> {label}</Button>} title="Upload files" description="Files are stored in a private bucket. Only people with access to the project can open them." action={uploadFiles} submitLabel="Upload">
      {projectId && <input type="hidden" name="project_id" value={projectId} />}
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      {taskId && <input type="hidden" name="task_id" value={taskId} />}
      {!projectId && projects && (
        <Field name="project_id" label={clientId ? "Project (optional)" : "Project"} required={!clientId} hint={clientId ? "Leave empty to file it at client level" : undefined}>
          <NativeSelect name="project_id" defaultValue=""><option value="">{clientId ? "Client-level file" : "Choose project"}</option>{projects.map((p) => <option key={p.value} value={p.value}>{p.label} · {p.sub}</option>)}</NativeSelect>
        </Field>
      )}
      <Field name="files" label="Files" required hint="Up to 50 MB each. PDFs, images, documents and design files.">
        <Input type="file" name="files" multiple className="h-auto py-1.5" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="folder" label="Folder"><Input name="folder" defaultValue={defaultFolder} /></Field>
        <Field name="category" label="Type">
          <NativeSelect name="category" defaultValue=""><option value="">Detect automatically</option>{FILE_CATEGORY.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
        </Field>
      </div>
      {allowShare && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="client_visible" className="size-4 accent-primary" /> Share with client in portal</label>
      )}
    </FormDialog>
  );
}
