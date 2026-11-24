import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { Pill } from "@/components/app/status-badge";
import { TabNav, currentTab } from "@/components/app/tab-nav";
import { companySettings } from "@/features/common/lookups";
import { BillingForm, CompanyForm, ProfileForms } from "@/features/settings/forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const s = await requireStaff();
  const sp = await searchParams;
  const admin = can(s.role, "settings.manage");
  const ids = admin ? ["company", "billing", "integrations", "profile"] : ["profile"];
  const tab = currentTab(sp, ids);
  const supabase = await createClient();
  const [settings, { data: profile }] = await Promise.all([companySettings(s.orgId), supabase.from("profiles").select("full_name, phone, email").eq("id", s.userId).single()]);
  const labels: Record<string, string> = { company: "Company", billing: "Billing & GST", integrations: "Integrations", profile: "My profile" };
  return (
    <>
      <PageHeader title="Settings" description={admin ? "Company profile, tax configuration, numbering and integrations." : "Your profile and password."} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]} />
      <TabNav base="/settings" current={tab} tabs={ids.map((i) => ({ id: i, label: labels[i]! }))} />
      {tab === "company" && <Panel title="Company profile" description="Printed on quotations, invoices and receipts." className="max-w-3xl"><CompanyForm s={settings} /></Panel>}
      {tab === "billing" && <Panel title="Billing & GST" description="Configure tax slabs — no fixed GST rate is assumed." className="max-w-3xl"><BillingForm s={settings} /></Panel>}
      {tab === "integrations" && (
        <Panel title="Integrations" description="What's connected. Nothing is reported as sent unless an integration is configured." className="max-w-3xl">
          <ul className="divide-y text-sm">
            {[
              ["Supabase Auth & Database", true, "Sign-in, data and RLS"],
              ["Supabase Storage (private bucket crm-files)", true, "File uploads & signed downloads"],
              ["Service role key (server)", isAdminClientConfigured(), "Needed to invite team members and portal users"],
              ["Email delivery (Resend / SMTP)", Boolean(process.env.RESEND_API_KEY), "Not wired in v1 — notifications are in-app only; Supabase sends auth emails"],
              ["WhatsApp", false, "Planned — notification_deliveries outbox table is ready"],
              ["Payment gateway", false, "Not in v1 — payments are recorded manually"],
            ].map(([name, on, note]) => (
              <li key={String(name)} className="flex items-start justify-between gap-4 py-3"><div><p className="font-medium">{name}</p><p className="text-xs text-muted-foreground">{note}</p></div><Pill tone={on ? "green" : "slate"}>{on ? "Configured" : "Not configured"}</Pill></li>
            ))}
          </ul>
        </Panel>
      )}
      {tab === "profile" && <Panel title="My profile" className="max-w-4xl"><ProfileForms name={profile?.full_name ?? s.fullName} phone={profile?.phone ?? null} email={profile?.email ?? s.email} /></Panel>}
    </>
  );
}
