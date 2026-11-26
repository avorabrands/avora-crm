import { requireLead } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { ProfileForms } from "@/features/settings/forms";

export const metadata = { title: "Your account" };

export default async function LeadProfile() {
  const s = await requireLead();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone, email").eq("id", s.userId).single();
  return (
    <>
      <PageHeader title="Your account" breadcrumbs={[{ label: "Quotations", href: "/lead" }, { label: "Account" }]} />
      <Panel title="Name, phone and password"><ProfileForms name={profile?.full_name ?? s.fullName} phone={profile?.phone ?? null} email={profile?.email ?? s.email} /></Panel>
    </>
  );
}
