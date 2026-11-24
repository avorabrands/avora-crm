import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/lib/auth/session";

export const BUCKET = "crm-files";
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
const BLOCKED = /\.(exe|bat|cmd|sh|msi|dll|com|scr|js|vbs|ps1)$/i;

function categorize(mime: string, name: string) {
  if (mime.startsWith("image/")) return "image";
  if (/\.(ai|psd|fig|sketch|indd|eps|xd|cdr|afdesign)$/i.test(name)) return "design";
  return "document";
}

/**
 * Uploads bytes to the private bucket as the signed-in user (storage RLS
 * applies), then records metadata in public.files (table RLS applies).
 * Pass rootFileId to add a new version of an existing file.
 */
export async function uploadFile(
  supabase: SupabaseClient,
  session: Session,
  file: File,
  opts: { clientId?: string | null; projectId?: string | null; deliverableId?: string | null; taskId?: string | null; folder?: string; category?: string; clientVisible?: boolean; rootFileId?: string | null },
) {
  if (file.size > MAX_FILE_BYTES) throw { code: "22023", message: `${file.name} is larger than 50 MB.` };
  if (BLOCKED.test(file.name)) throw { code: "22023", message: `${file.name}: executable files are not allowed.` };

  let version = 1;
  let clientId = opts.clientId ?? null;
  let projectId = opts.projectId ?? null;
  let deliverableId = opts.deliverableId ?? null;
  let folder = opts.folder ?? "General";
  let category = opts.category ?? categorize(file.type, file.name);
  let clientVisible = opts.clientVisible ?? false;

  if (opts.rootFileId) {
    const { data: root, error } = await supabase.from("files").select("id, client_id, project_id, deliverable_id, folder, category, client_visible").eq("id", opts.rootFileId).single();
    if (error || !root) throw error ?? { code: "PGRST116", message: "Original file not found" };
    const { data: latest } = await supabase.from("files").select("version").or(`id.eq.${root.id},root_file_id.eq.${root.id}`).order("version", { ascending: false }).limit(1).single();
    version = (latest?.version ?? 1) + 1;
    clientId = root.client_id; projectId = root.project_id; deliverableId = root.deliverable_id; folder = root.folder; category = root.category;
    clientVisible = opts.clientVisible ?? root.client_visible;
  }
  if (projectId && !clientId) {
    const { data: p } = await supabase.from("projects").select("client_id").eq("id", projectId).single();
    clientId = p?.client_id ?? null;
  }

  const safe = file.name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(-120) || "file";
  const path = `${session.orgId}/${clientId ?? "_"}/${projectId ?? "_"}/${crypto.randomUUID()}-${safe}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) throw { code: "STORAGE", message: `Upload failed: ${upErr.message}` };

  const { data, error } = await supabase.from("files").insert({
    organization_id: session.orgId, client_id: clientId, project_id: projectId, deliverable_id: deliverableId, task_id: opts.taskId ?? null,
    folder, name: file.name, storage_path: path, mime_type: file.type || null, size_bytes: file.size, category, version,
    root_file_id: opts.rootFileId ?? null, is_latest: true, client_visible: clientVisible, uploaded_by: session.userId,
  }).select("id, version").single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]); // don't leave orphans
    throw error;
  }
  return data as { id: string; version: number };
}
