import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { TabNav, currentTab } from "@/components/app/tab-nav";
import { clientOptions, projectOptions, staffOptions } from "@/features/common/lookups";
import { buildReport, parseFilters, REPORT_KEYS, type ReportKey } from "@/features/reports/data";
import { ReportFilters } from "@/features/reports/filters";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };
const LABELS: Record<ReportKey, string> = { monthly_revenue: "Monthly revenue", client_revenue: "Client revenue", outstanding: "Outstanding", profitability: "Profitability", lead_conversion: "Lead conversion", pipeline: "Pipeline", project_completion: "Project completion", team_productivity: "Team productivity", delayed_projects: "Delayed projects" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const s = await requireStaff("reports.view");
  const sp = await searchParams;
  const admin = can(s.role, "profitability.view");
  const keys = REPORT_KEYS.filter((k) => k !== "profitability" || admin);
  const tab = currentTab(sp, keys as unknown as string[]) as ReportKey;
  const f = parseFilters(sp);
  const [report, clients, projects, staff] = await Promise.all([buildReport(tab, f, { admin }), clientOptions(), projectOptions(), staffOptions(s.orgId)]);
  const qs = new URLSearchParams(Object.entries({ from: f.from, to: f.to, client: f.client ?? "", project: f.project ?? "", employee: f.employee ?? "" }).filter(([, v]) => v)).toString();
  const totals = report?.columns.filter((c) => c.money).map((c) => [c.key, report.rows.reduce((a, r) => a + Number(r[c.key] ?? 0), 0)] as const) ?? [];

  return (
    <>
      <PageHeader title="Reports" description="Filter by date range, client, project and employee. Export any report as CSV." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]}
        actions={report && <Button variant="outline" render={<a href={`/api/reports/${tab}?${qs}`} />}><Download /> Export CSV</Button>} />
      <ReportFilters from={f.from} to={f.to} clients={clients} projects={projects} staff={staff} />
      <TabNav base={qs ? `/reports?${qs}` : "/reports"} current={tab} tabs={keys.map((k) => ({ id: k, label: LABELS[k] }))} />
      {report && (
        <Panel title={report.title} description={report.description} bodyClassName="p-0">
          {report.rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No data for these filters.</p> : (
            <Table>
              <TableHeader><TableRow>{report.columns.map((c, i) => <TableHead key={c.key} className={cn(c.align === "right" && "text-right", i === 0 && "pl-4", i === report.columns.length - 1 && "pr-4")}>{c.label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {report.rows.map((r, ri) => (
                  <TableRow key={ri}>{report.columns.map((c, i) => <TableCell key={c.key} label={i ? c.label : undefined} className={cn("tabular-nums", c.align === "right" && "text-right", i === 0 && "pl-4 font-medium", i === report.columns.length - 1 && "pr-4")}>{c.money ? formatINR(Number(r[c.key])) : r[c.key]}</TableCell>)}</TableRow>
                ))}
              </TableBody>
              {totals.length > 0 && (
                <TableFooter><TableRow>{report.columns.map((c, i) => <TableCell key={c.key} label={i && c.money ? c.label : undefined} className={cn("font-semibold tabular-nums", c.align === "right" && "text-right", i === 0 && "pl-4", i === report.columns.length - 1 && "pr-4")}>{i === 0 ? "Total" : c.money ? formatINR(totals.find((t) => t[0] === c.key)?.[1] ?? 0) : ""}</TableCell>)}</TableRow></TableFooter>
              )}
            </Table>
          )}
        </Panel>
      )}
    </>
  );
}
