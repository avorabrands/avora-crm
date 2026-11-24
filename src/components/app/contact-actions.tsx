import { Mail, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

/** wa.me needs a full international number; bare 10-digit numbers are treated as Indian. */
function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
}

/** One-tap call / WhatsApp / email. Opens the person's own apps — nothing is sent by the CRM. */
export function ContactActions({ phone, email, name, labels = false, className }: { phone?: string | null; email?: string | null; name: string; labels?: boolean; className?: string }) {
  if (!phone && !email) return null;
  const cls = cn("inline-flex items-center justify-center gap-2 rounded-lg border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary", labels ? "min-h-10 flex-1 px-3 text-sm font-medium" : "size-9");
  return (
    <div className={cn("flex items-center gap-2", labels && "flex-wrap", className)}>
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={cls} aria-label={`Call ${name}`}><Phone className="size-4" />{labels && "Call"}</a>}
      {phone && <a href={`https://wa.me/${waNumber(phone)}`} target="_blank" rel="noreferrer" className={cls} aria-label={`WhatsApp ${name}`}><MessageCircle className="size-4" />{labels && "WhatsApp"}</a>}
      {email && <a href={`mailto:${email}`} className={cls} aria-label={`Email ${name}`}><Mail className="size-4" />{labels && "Email"}</a>}
    </div>
  );
}
