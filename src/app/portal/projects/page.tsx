import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_CATEGORY, PROJECT_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { ProgressBar } from "@/features/projects/components/projects-table";

export default async function PortalProjects() {
  await requireClient();
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, name, code, category, status, progress, start_date, due_date").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="My projects" description="Everything Avora is working on for you." />
      {(data ?? []).length === 0 ? <div className="rounded-xl border bg-card"><EmptyState icon={FolderKanban} title="No projects shared yet" /></div> : (
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((p) => (
            <Link key={p.id} href={`/portal/projects/${p.id}`} className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.code} · {PROJECT_CATEGORY.label[p.category as keyof typeof PROJECT_CATEGORY.label]}</p></div><StatusBadge def={PROJECT_STATUS} value={p.status} /></div>
              <ProgressBar value={p.progress} className="mt-4" />
              <p className="mt-2 text-xs text-muted-foreground">{formatDate(p.start_date)} → {formatDate(p.due_date)}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
