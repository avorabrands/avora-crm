import { format, formatDistanceToNowStrict, isValid, parseISO, differenceInCalendarDays } from "date-fns";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

export const formatINR = (value: number | string | null | undefined) => inr.format(Number(value ?? 0));
export const formatINRCompact = (value: number | string | null | undefined) => inrCompact.format(Number(value ?? 0));
export const formatNumber = (n: number) => new Intl.NumberFormat("en-IN").format(n);

function toDate(d: string | Date | null | undefined) {
  if (!d) return null;
  const date = typeof d === "string" ? parseISO(d) : d;
  return isValid(date) ? date : null;
}
export const formatDate = (d: string | Date | null | undefined, pattern = "dd MMM yyyy") => {
  const date = toDate(d);
  return date ? format(date, pattern) : "—";
};
export const formatDateTime = (d: string | Date | null | undefined) => formatDate(d, "dd MMM yyyy, h:mm a");
export const formatRelative = (d: string | Date | null | undefined) => {
  const date = toDate(d);
  return date ? formatDistanceToNowStrict(date, { addSuffix: true }) : "—";
};
export const daysUntil = (d: string | null | undefined) => {
  const date = toDate(d);
  return date ? differenceInCalendarDays(date, new Date()) : null;
};
export const todayISO = () => format(new Date(), "yyyy-MM-dd");
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
export const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};

/** Derived invoice status: unpaid/partial past due date => overdue. */
export function effectiveInvoiceStatus(inv: { status: string; due_date: string | null }) {
  if ((inv.status === "unpaid" || inv.status === "partially_paid") && inv.due_date && inv.due_date < todayISO()) return "overdue";
  return inv.status;
}
/** ISO date n days from today (keeps impure Date calls out of render bodies). */
export const daysFromTodayISO = (n: number) => format(new Date(new Date().setDate(new Date().getDate() + n)), "yyyy-MM-dd");
export const daysAgoTimestamp = (n: number) => new Date(new Date().getTime() - n * 864e5).toISOString();
/** First name for greetings, skipping honorifics ("Dr. Kavya Rao" → "Kavya"). */
export const firstName = (full: string) =>
  full.split(/\s+/).find((p) => p && !/^(dr|mr|mrs|ms|miss|prof|sri|smt|shri)\.?$/i.test(p))?.replace(/[()]/g, "") ?? full;
