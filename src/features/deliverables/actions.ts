"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, toActionError, unwrap, type ActionState } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { APPROVAL_STATUS, DESIGN_STATUS, REVIEW_STATUS } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { uploadFile } from "@/features/files/upload";

const path = (projectId: string) => `/projects/${projectId}`;

export async function addDeliverables(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff("projects.manage");
    const names = String(fd.get("names") ?? "").split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
    if (!names.length) return fail("Enter at least one deliverable name.", { names: "One name per line" });
    if (names.length > 500) return fail("Add up to 500 deliverables at a time.");
    const assigned = (fd.get("assigned_to") as string) || null;
    const contentReceived = fd.get("content_received") === "on";
    const supabase = await createClient();
    const { count } = await supabase.from("deliverables").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    unwrap(await supabase.from("deliverables").insert(names.map((name, i) => ({
      organization_id: s.orgId, project_id: projectId, name, position: (count ?? 0) + i + 1, assigned_to: assigned,
      content_received: contentReceived, content_received_at: contentReceived ? todayISO() : null,
    }))).select("id"));
    await logActivity(supabase, s, { entityType: "project", entityId: projectId, action: "deliverables_added", summary: `Added ${names.length} deliverable${names.length > 1 ? "s" : ""}`, projectId });
    revalidatePath(path(projectId));
    return ok(`${names.length} deliverable${names.length > 1 ? "s" : ""} added`);
  } catch (e) { return toActionError(e); }
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  content_received: z.boolean().optional(),
  design_status: z.enum(DESIGN_STATUS.values).optional(),
  assigned_to: z.uuid().nullable().optional(),
  internal_review_status: z.enum(REVIEW_STATUS.values).optional(),
  client_review_status: z.enum(REVIEW_STATUS.values).optional(),
  approval_status: z.enum(APPROVAL_STATUS.values).optional(),
  submitted_at: z.iso.date().nullable().optional(),
  final_delivered_at: z.iso.date().nullable().optional(),
  client_visible: z.boolean().optional(),
}).strict();
export type DeliverablePatch = z.infer<typeof patchSchema>;

/** Single or bulk update. Team members can update workflow fields on their projects (RLS); approval overrides are manager-only. */
export async function updateDeliverables(projectId: string, ids: string[], patch: DeliverablePatch): Promise<ActionState> {
  try {
    const s = await authorizeStaff();
    if (!ids.length) return fail("Select at least one deliverable.");
    const p = patchSchema.parse(patch);
    const managerOnly = ["approval_status", "client_review_status", "client_visible", "name", "final_delivered_at"] as const;
    if (managerOnly.some((k) => k in p) && !can(s.role, "projects.manage")) return fail("Only managers can change approvals, delivery or client visibility.");
    const row: Record<string, unknown> = { ...p };
    if (p.content_received !== undefined) row.content_received_at = p.content_received ? todayISO() : null;
    if (p.design_status === "completed" && !("internal_review_status" in p)) row.internal_review_status = "pending";
    const supabase = await createClient();
    const { data, error } = await supabase.from("deliverables").update(row).in("id", ids).eq("project_id", projectId).select("id");
    if (error) throw error;
    if (!data?.length) return fail("Nothing was updated — you may not have access to these deliverables.");
    if (p.final_delivered_at || p.approval_status === "approved") {
      await logActivity(supabase, s, { entityType: "project", entityId: projectId, action: "deliverables_updated", summary: p.final_delivered_at ? `${data.length} deliverable(s) marked as delivered` : `${data.length} deliverable(s) approved`, projectId, clientVisible: true });
    }
    revalidatePath(path(projectId));
    return ok(ids.length > 1 ? `${data.length} deliverables updated` : "Saved");
  } catch (e) { return toActionError(e); }
}

/** Share the current design with the client and open it for review. */
export async function sendDeliverablesToClient(projectId: string, ids: string[]): Promise<ActionState> {
  try {
    const s = await authorizeStaff("projects.manage");
    const supabase = await createClient();
    const { data: rows } = await supabase.from("deliverables").select("id, name, current_file_id, approval_status").in("id", ids).eq("project_id", projectId);
    const ready = (rows ?? []).filter((d) => d.current_file_id && d.approval_status !== "approved");
    if (!ready.length) return fail("Upload a design file first — only deliverables with a file that aren't yet approved can be sent.");
    const fileIds = ready.map((d) => d.current_file_id as string);
    await supabase.from("files").update({ client_visible: true }).in("id", fileIds);
    unwrap(await supabase.from("deliverables").update({ client_visible: true, client_review_status: "pending", internal_review_status: "approved", submitted_at: todayISO() }).in("id", ready.map((d) => d.id)).select("id"));
    const { data: proj } = await supabase.from("projects").select("client_id").eq("id", projectId).single();
    await logActivity(supabase, s, { entityType: "project", entityId: projectId, action: "sent_for_review", summary: ready.length === 1 ? `“${ready[0]!.name}” shared for your review` : `${ready.length} designs shared for your review`, projectId, clientId: proj?.client_id, clientVisible: true });
    revalidatePath(path(projectId));
    const skipped = ids.length - ready.length;
    return ok(`Sent ${ready.length} for client review${skipped ? ` · ${skipped} skipped (no file or already approved)` : ""}. They'll see it in the portal.`);
  } catch (e) { return toActionError(e); }
}

export async function deleteDeliverables(projectId: string, ids: string[]): Promise<ActionState> {
  try {
    await authorizeStaff("projects.manage");
    const supabase = await createClient();
    const { data, error } = await supabase.from("deliverables").delete().in("id", ids).eq("project_id", projectId).select("id");
    if (error) throw error;
    revalidatePath(path(projectId));
    return ok(`${data?.length ?? 0} deliverable(s) deleted`);
  } catch (e) { return toActionError(e); }
}

/** Upload a new design version for one deliverable. */
export async function uploadDeliverableFile(projectId: string, deliverableId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff();
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return fail("Choose a file.", { file: "Choose a file" });
    const supabase = await createClient();
    const v = await attachFile(supabase, s, projectId, deliverableId, file);
    revalidatePath(path(projectId));
    return ok(`Uploaded v${v} — awaiting internal review`);
  } catch (e) { return toActionError(e); }
}

/** Bulk upload: match each file name to a deliverable name (e.g. "MBA Brochure.pdf" → "MBA"). */
export async function bulkUploadDeliverableFiles(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const s = await authorizeStaff();
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return fail("Choose files to upload.", { files: "Choose files" });
    const supabase = await createClient();
    const { data: dels } = await supabase.from("deliverables").select("id, name, approval_status").eq("project_id", projectId);
    const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    // deliverable names keep their dots ("D.Pharm"); only file names lose their extension
    const fileKey = (n: string) => ` ${words(n.replace(/\.[a-z0-9]{2,5}$/i, ""))} `;
    const candidates = (dels ?? [])
      .filter((d) => d.approval_status !== "approved")
      .map((d) => ({ id: d.id as string, key: words(d.name as string) }))
      .filter((c) => c.key.length >= 2)
      .sort((a, b) => b.key.length - a.key.length); // most specific name wins ("BBA Aviation" before "BBA")
    let matched = 0;
    const unmatched: string[] = [];
    for (const f of files) {
      const key = fileKey(f.name);
      const hit = candidates.find((c) => key.includes(` ${c.key} `)); // whole-word match only
      if (!hit) { unmatched.push(f.name); continue; }
      await attachFile(supabase, s, projectId, hit.id, f);
      matched++;
    }
    revalidatePath(path(projectId));
    if (!matched) return fail(`No file names matched a deliverable. Name files after the deliverable (e.g. "${dels?.[0]?.name ?? "Course name"}.pdf").`);
    return ok(`${matched} file(s) attached${unmatched.length ? ` · not matched: ${unmatched.slice(0, 5).join(", ")}${unmatched.length > 5 ? "…" : ""}` : ""}`);
  } catch (e) { return toActionError(e); }
}

async function attachFile(supabase: Awaited<ReturnType<typeof createClient>>, s: Awaited<ReturnType<typeof authorizeStaff>>, projectId: string, deliverableId: string, file: File) {
  const d = unwrap(await supabase.from("deliverables").select("id, approval_status, current_file_id, files:files!deliverables_current_file_fk(id, root_file_id)").eq("id", deliverableId).eq("project_id", projectId).single());
  const cur = d.files as { id: string; root_file_id: string | null } | null;
  const rootFileId = cur ? cur.root_file_id ?? cur.id : null;
  const f = await uploadFile(supabase, s, file, { projectId, deliverableId, folder: "Deliverables", category: "design", clientVisible: false, rootFileId });
  // a new version re-enters internal review, but never silently un-approves an approved deliverable
  const patch = d.approval_status === "approved" ? { current_file_id: f.id } : { current_file_id: f.id, design_status: "completed", internal_review_status: "pending" };
  unwrap(await supabase.from("deliverables").update(patch).eq("id", deliverableId).select("id"));
  return f.version;
}

/** Manager records a client decision received offline (email/phone). Goes through the same RPC as the portal. */
export async function recordClientDecision(projectId: string, deliverableId: string, decision: "approved" | "revision_requested", comment: string): Promise<ActionState> {
  try {
    await authorizeStaff("projects.manage");
    const supabase = await createClient();
    const { error } = await supabase.rpc("client_review_deliverable", { p_deliverable: deliverableId, p_decision: decision, p_comment: comment || null });
    if (error) throw error;
    revalidatePath(path(projectId));
    return ok(decision === "approved" ? "Approval recorded" : "Revision request recorded");
  } catch (e) { return toActionError(e); }
}

export async function resolveRevision(projectId: string, revisionId: string): Promise<ActionState> {
  try {
    await authorizeStaff();
    const supabase = await createClient();
    unwrap(await supabase.from("revisions").update({ resolved_at: new Date().toISOString() }).eq("id", revisionId).select("id").single());
    revalidatePath(path(projectId));
    return ok("Revision marked as addressed");
  } catch (e) { return toActionError(e); }
}
