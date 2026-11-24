"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR, formatINRCompact } from "@/lib/format";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };

function TipBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

/** Single-series monthly revenue (payments received). One hue, no legend needed. */
export function RevenueChart({ data }: { data: { month: string; amount: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Monthly revenue received, last 12 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatINRCompact(v)} />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={({ active, payload, label }) => active && payload?.length ? <TipBox label={String(label)} value={formatINR(Number(payload[0]!.value))} /> : null} />
          <Bar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal magnitude bars (counts or values per stage). */
export function StageBars({ data, money = false, label }: { data: { stage: string; value: number }[]; money?: boolean; label: string }) {
  const height = Math.max(160, data.length * 34);
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap="30%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="stage" tick={AXIS} tickLine={false} axisLine={false} width={130} />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={({ active, payload }) => active && payload?.length ? <TipBox label={String(payload[0]!.payload.stage)} value={money ? formatINR(Number(payload[0]!.value)) : String(payload[0]!.value)} /> : null} />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={18}
            label={{ position: "right", fontSize: 11, fill: "var(--muted-foreground)", formatter: (v: unknown) => (money ? formatINRCompact(Number(v)) : String(v)) }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
