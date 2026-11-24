import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { buildReport, parseFilters, REPORT_KEYS, toCSV, type ReportKey } from "@/features/reports/data";

/** CSV export: GET /api/reports/:key?from=&to=&client=&project=&employee= */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/reports/[report]">) {
  const s = await getSession();
  if (!s || !can(s.role, "reports.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { report } = await ctx.params;
  if (!REPORT_KEYS.includes(report as ReportKey)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const r = await buildReport(report as ReportKey, filters, { admin: can(s.role, "profitability.view") });
  if (!r) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return new NextResponse("﻿" + toCSV(r), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="avora-${report}-${filters.from}-to-${filters.to}.csv"` } });
}
