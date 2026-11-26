/** Print layouts for quotations and invoices. Stored per document; company settings hold the default. */
export const DOCUMENT_TEMPLATES = ["classic", "modern", "professional"] as const;
export type DocTemplate = (typeof DOCUMENT_TEMPLATES)[number];

export const TEMPLATE_INFO: Record<DocTemplate, { label: string; description: string }> = {
  classic: { label: "Classic", description: "Clean and light, with a purple accent" },
  modern: { label: "Modern", description: "Avora black and blue, with a highlighted total" },
  professional: { label: "Professional", description: "Boxed GST format with amount in words and signature" },
};

export function asTemplate(v: unknown, fallback: DocTemplate = "classic"): DocTemplate {
  return (DOCUMENT_TEMPLATES as readonly string[]).includes(String(v)) ? (v as DocTemplate) : fallback;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`; }
function belowThousand(n: number) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/** Indian numbering in words: 125000.5 → "Rupees One Lakh Twenty Five Thousand and Fifty Paise Only". */
export function amountInWordsINR(amount: number) {
  const value = Math.round(Math.abs(Number(amount) || 0) * 100);
  let rupees = Math.floor(value / 100);
  const paise = value % 100;
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1e7); rupees %= 1e7;
  const lakh = Math.floor(rupees / 1e5); rupees %= 1e5;
  const thousand = Math.floor(rupees / 1e3); rupees %= 1e3;
  if (crore) parts.push(`${crore >= 1000 ? amountInWordsINR(crore).replace(/^Rupees | Only$/g, "") : belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rupees) parts.push(belowThousand(rupees));
  const r = parts.join(" ") || "Zero";
  return `Rupees ${r}${paise ? ` and ${belowHundred(paise)} Paise` : ""} Only`;
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
