-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0011 fourth document template: "standard" (bordered tax
-- invoice with per-line GST columns, amount in words and signature box).
-- ════════════════════════════════════════════════════════════════════════
alter table public.quotations drop constraint quotations_template_check,
  add constraint quotations_template_check check (template in ('classic', 'modern', 'professional', 'standard'));
alter table public.invoices drop constraint invoices_template_check,
  add constraint invoices_template_check check (template in ('classic', 'modern', 'professional', 'standard'));
alter table public.company_settings drop constraint company_settings_quotation_template_check,
  add constraint company_settings_quotation_template_check check (quotation_template in ('classic', 'modern', 'professional', 'standard')),
  drop constraint company_settings_invoice_template_check,
  add constraint company_settings_invoice_template_check check (invoice_template in ('classic', 'modern', 'professional', 'standard'));
