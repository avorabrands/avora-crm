import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { DescriptionList, Panel } from "@/components/app/panel";
import { ProfileForms } from "@/features/settings/forms";
import { portalMe } from "@/features/portal/queries";

export default async function PortalProfile() {
  const s = await requireClient();
  const supabase = await createClient();
  const [me, { data: profile }] = await Promise.all([portalMe(), supabase.from("profiles").select("full_name, phone, email").eq("id", s.userId).single()]);
  return (
    <>
      <PageHeader title="Profile" />
      <div className="space-y-6">
        <Panel title="Company on file" description="To update billing details, contact your Avora account manager.">
          <DescriptionList items={[{ label: "Company", value: me?.company_name }, { label: "Client ID", value: me?.code }, { label: "Contact", value: me?.contact_person }, { label: "Email", value: me?.email }, { label: "Phone", value: me?.phone }, { label: "GSTIN", value: me?.gstin }, { label: "Billing address", value: me?.billing_address }]} />
        </Panel>
        <Panel title="Your account"><ProfileForms name={profile?.full_name ?? s.fullName} phone={profile?.phone ?? null} email={profile?.email ?? s.email} /></Panel>
      </div>
    </>
  );
}
