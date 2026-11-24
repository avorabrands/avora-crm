"use server";

import { revalidatePath } from "next/cache";
import { authorize, authorizeStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, toActionError, unwrap, type ActionState } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { BUCKET, uploadFile } from "./upload";

/** Multi-file upload from a form: files[], client_id?, project_id?, folder, category, client_visible */
export async function uploadFiles(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff();
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return fail("Choose at least one file.", { files: "Choose at least one file" });
    const supabase = await createClient();
    const projectId = (fd.get("project_id") as string) || null;
    const clientId = (fd.get("client_id") as string) || null;
    const taskId = (fd.get("task_id") as string) || null;
    const folder = ((fd.get("folder") as string) || "General").trim().slice(0, 60);
    const category = (fd.get("category") as string) || undefined;
    const clientVisible = fd.get("client_visible") === "on";
    if (!projectId && !clientId) return fail("Choose a client or project for these files.", { project_id: "Required" });
    for (const f of files) await uploadFile(supabase, s, f, { projectId, clientId, taskId, folder, category, clientVisible });
    await logActivity(supabase, s, { entityType: "file", action: "uploaded", summary: `Uploaded ${files.length} file${files.length > 1 ? "s" : ""} to ${folder}`, clientId, projectId, clientVisible });
    revalidatePath("/files"); if (projectId) revalidatePath(`/projects/${projectId}`); if (clientId) revalidatePath(`/clients/${clientId}`); if (taskId) revalidatePath(`/tasks/${taskId}`);
    return ok(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`);
  } catch (e) { return toActionError(e); }
}

export async function uploadNewVersion(rootFileId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff();
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return fail("Choose a file.", { file: "Choose a file" });
    const supabase = await createClient();
    const f = await uploadFile(supabase, s, file, { rootFileId });
    revalidatePath("/files");
    return ok(`Version ${f.version} uploaded`);
  } catch (e) { return toActionError(e); }
}

export async function setFileVisibility(id: string, visible: boolean): Promise<ActionState> {
  try {
    await authorizeStaff("projects.manage");
    const supabase = await createClient();
    const f = unwrap(await supabase.from("files").select("id, root_file_id").eq("id", id).single());
    const root = f.root_file_id ?? f.id;
    // visibility applies to the whole version chain
    await supabase.from("files").update({ client_visible: visible }).or(`id.eq.${root},root_file_id.eq.${root}`);
    revalidatePath("/files");
    return ok(visible ? "Shared with client" : "Hidden from client");
  } catch (e) { return toActionError(e); }
}

export async function deleteFile(id: string): Promise<ActionState> {
  try {
    await authorizeStaff("files.delete");
    const supabase = await createClient();
    const f = unwrap(await supabase.from("files").select("id, storage_path, root_file_id").eq("id", id).single());
    const { data: chain } = f.root_file_id ? { data: [] } : await supabase.from("files").select("storage_path").eq("root_file_id", f.id);
    const paths = [f.storage_path, ...(chain ?? []).map((c) => c.storage_path as string)];
    // Remove bytes FIRST: the storage read policy is keyed on the metadata row,
    // so once the row is gone the storage API can no longer see (or delete) the object.
    const { data: removed, error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
    if (rmErr) return fail(`Couldn't delete the stored file: ${rmErr.message}`);
    if ((removed?.length ?? 0) < paths.length) return fail("Some stored versions couldn't be deleted. Please try again.");
    unwrap(await supabase.from("files").delete().eq("id", id).select("id").single());
    if (f.root_file_id) {
      // promote the newest remaining version
      const { data: newest } = await supabase.from("files").select("id").or(`id.eq.${f.root_file_id},root_file_id.eq.${f.root_file_id}`).order("version", { ascending: false }).limit(1).maybeSingle();
      if (newest) await supabase.from("files").update({ is_latest: true }).eq("id", newest.id);
    }
    revalidatePath("/files");
    return ok("File deleted");
  } catch (e) { return toActionError(e); }
}

/** Short-lived signed URL for preview/download — RLS decides if the caller may read it. */
export async function signedFileUrl(id: string, download = false) {
  await authorize();
  const supabase = await createClient();
  const { data: f } = await supabase.from("files").select("storage_path, name").eq("id", id).maybeSingle();
  if (!f) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 300, download ? { download: f.name } : undefined);
  return data?.signedUrl ?? null;
}
