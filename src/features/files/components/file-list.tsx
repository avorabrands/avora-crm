"use client";

import { Download, Eye, EyeOff, FileArchive, FileImage, FileText, History, Share2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActionTrigger } from "@/components/app/confirm";
import { Field, FormDialog } from "@/components/app/form";
import { RowActions } from "@/components/app/row-actions";
import { Pill, StatusBadge } from "@/components/app/status-badge";
import { FILE_CATEGORY } from "@/lib/constants";
import { formatBytes, formatDate } from "@/lib/format";
import { canPreview } from "@/lib/files";
import { deleteFile, setFileVisibility, uploadNewVersion } from "../actions";
import type { FileRow } from "../queries";

function FileIcon({ mime, name }: { mime: string | null; name: string }) {
  if (mime?.startsWith("image/")) return <FileImage className="size-4 text-blue-500" />;
  if (/\.(zip|rar|7z)$/i.test(name)) return <FileArchive className="size-4 text-amber-500" />;
  return <FileText className="size-4 text-violet-500" />;
}


export function FileList({ files, showContext = false, canManage, canDelete }: { files: FileRow[]; showContext?: boolean; canManage: boolean; canDelete: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Name</TableHead>
          {showContext && <TableHead>Project / client</TableHead>}
          <TableHead>Folder</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead>Client</TableHead>
          <TableHead className="pr-4"><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((f) => {
          const root = f.root_file_id ?? f.id;
          return (
            <TableRow key={f.id}>
              <TableCell className="max-w-72 pl-4">
                <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-medium hover:text-primary">
                  <FileIcon mime={f.mime_type} name={f.name} /><span className="truncate">{f.name}</span>
                </a>
              </TableCell>
              {showContext && <TableCell className="text-xs text-muted-foreground">{f.project?.name ?? f.client?.company_name ?? "—"}</TableCell>}
              <TableCell className="text-xs">{f.folder}</TableCell>
              <TableCell><StatusBadge def={FILE_CATEGORY} value={f.category} /></TableCell>
              <TableCell><Pill tone={f.version > 1 ? "purple" : "neutral"}>v{f.version}</Pill></TableCell>
              <TableCell className="text-xs tabular-nums text-muted-foreground">{formatBytes(f.size_bytes)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDate(f.created_at)}<br />{f.uploader?.full_name}</TableCell>
              <TableCell>{f.client_visible ? <Pill tone="teal"><Share2 className="size-3" /> Shared</Pill> : <span className="text-xs text-muted-foreground">Internal</span>}</TableCell>
              <TableCell className="pr-4">
                <RowActions onDelete={canDelete ? () => deleteFile(f.id) : undefined} deleteTitle={`Delete ${f.name}?`} deleteDescription={f.root_file_id ? "This version will be permanently deleted." : "The file and all its versions will be permanently deleted."}>
                  {canPreview(f.mime_type) && (
                    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" render={<a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" aria-label="Preview" />} />}><Eye /></TooltipTrigger><TooltipContent>Preview</TooltipContent></Tooltip>
                  )}
                  <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" render={<a href={`/api/files/${f.id}?download=1`} aria-label="Download" />} />}><Download /></TooltipTrigger><TooltipContent>Download</TooltipContent></Tooltip>
                  {f.version > 1 && (
                    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" render={<a href={`/files/${root}/versions`} aria-label="Version history" />} />}><History /></TooltipTrigger><TooltipContent>Version history</TooltipContent></Tooltip>
                  )}
                  {canManage && (
                    <>
                      <FormDialog trigger={<Button variant="ghost" size="icon-sm" aria-label="Upload new version"><Upload /></Button>} title={`New version of ${f.name}`} description={`Uploads v${f.version + 1}. Earlier versions stay available in the history.`} action={uploadNewVersion.bind(null, root)} submitLabel="Upload version">
                        <Field name="file" label="File" required><Input type="file" name="file" className="h-auto py-1.5" /></Field>
                      </FormDialog>
                      <ActionTrigger action={() => setFileVisibility(f.id, !f.client_visible)} className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        {f.client_visible ? <EyeOff className="size-4" aria-label="Hide from client" /> : <Share2 className="size-4" aria-label="Share with client" />}
                      </ActionTrigger>
                    </>
                  )}
                </RowActions>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
