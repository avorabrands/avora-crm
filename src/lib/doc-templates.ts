/** Print layouts for quotations and invoices. Stored per document; company settings hold the default. */
export const DOCUMENT_TEMPLATES = ["classic", "modern", "professional", "standard"] as const;
export type DocTemplate = (typeof DOCUMENT_TEMPLATES)[number];

export const TEMPLATE_INFO: Record<DocTemplate, { label: string; description: string }> = {
  classic: { label: "Classic", description: "Clean and light, with a purple accent" },
  modern: { label: "Modern", description: "Avora black and blue, with a highlighted total" },
  professional: { label: "Professional", description: "Boxed GST format with amount in words and signature" },
  standard: { label: "Standard", description: "Bordered tax invoice with GST columns on every line" },
};

export function asTemplate(v: unknown, fallback: DocTemplate = "classic"): DocTemplate {
  return (DOCUMENT_TEMPLATES as readonly string[]).includes(String(v)) ? (v as DocTemplate) : fallback;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number, sep = " ") { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `${sep}${ONES[n % 10]}` : ""}`; }
function belowThousand(n: number, sep = " ") {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r, sep) : ""].filter(Boolean).join(" ");
}

/**
 * Indian numbering in words: 125000.5 → "Rupees One Lakh Twenty Five Thousand and Fifty Paise Only".
 * `style: "invoice"` gives "Indian Rupee One Lakh Twenty-Five Thousand … Only".
 */
export function amountInWordsINR(amount: number, style: "plain" | "invoice" = "plain"): string {
  const sep = style === "invoice" ? "-" : " ";
  const value = Math.round(Math.abs(Number(amount) || 0) * 100);
  let rupees = Math.floor(value / 100);
  const paise = value % 100;
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1e7); rupees %= 1e7;
  const lakh = Math.floor(rupees / 1e5); rupees %= 1e5;
  const thousand = Math.floor(rupees / 1e3); rupees %= 1e3;
  if (crore) parts.push(`${crore >= 1000 ? amountInWordsINR(crore, style).replace(/^(Rupees|Indian Rupee) | Only$/g, "") : belowThousand(crore, sep)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh, sep)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand, sep)} Thousand`);
  if (rupees) parts.push(belowThousand(rupees, sep));
  const r = parts.join(" ") || "Zero";
  return `${style === "invoice" ? "Indian Rupee" : "Rupees"} ${r}${paise ? ` and ${belowHundred(paise, sep)} Paise` : ""} Only`;
}

/** "Due on Receipt" when due the same day, otherwise "Net 15" etc. */
export function invoiceTermsLabel(invoiceDate: string, dueDate: string) {
  const days = Math.round((Date.parse(dueDate) - Date.parse(invoiceDate)) / 86_400_000);
  return !Number.isFinite(days) || days <= 0 ? "Due on Receipt" : `Net ${days}`;
}

/**
 * File name for "Save as PDF" (browsers use the page title):
 * "Quotation QT-2026-0001 - Vydehi - Brochure Design". Strips characters that
 * Windows/macOS don't allow in file names.
 */
export function documentFileName(...parts: (string | null | undefined)[]) {
  return parts
    .map((p) => (p ?? "").replace(/[\\/:*?"<>|\n\r\t]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" - ")
    .slice(0, 150)
    .trim();
}

/** Subject for the file name: the title, else the first item ("Logo design +2 more"). */
export function documentSubject(title: string | null | undefined, items: { name: string }[]) {
  if (title?.trim()) return title;
  if (!items.length) return null;
  return items.length > 1 ? `${items[0].name} +${items.length - 1} more` : items[0].name;
}

/** Bank details are stored as one printable block ("Bank: …\nA/c: …\nIFSC: …"); Settings edits the three parts separately. */
export function parseBankDetails(text: string | null | undefined) {
  const out = { bank: "", account: "", ifsc: "" };
  const extra: string[] = [];
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(bank(?: name)?|a\/c(?: no\.?)?|account(?: no\.?| number)?|ifsc(?: code)?)\s*[:\-]\s*(.*)$/i);
    if (!m) { extra.push(line); continue; }
    const key = m[1].toLowerCase();
    if (key.startsWith("bank")) out.bank = m[2];
    else if (key.startsWith("ifsc")) out.ifsc = m[2];
    else out.account = m[2];
  }
  if (extra.length) out.bank = [out.bank, ...extra].filter(Boolean).join(", ");
  return out;
}

export function formatBankDetails(p: { bank?: string | null; account?: string | null; ifsc?: string | null }) {
  const lines = [p.bank && `Bank: ${p.bank}`, p.account && `A/c: ${p.account}`, p.ifsc && `IFSC: ${p.ifsc}`].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}
