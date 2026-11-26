-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — 0009 save a quotation / invoice and its line items in ONE
-- transaction. Previously the header was written first, so a failed line-item
-- insert left an empty ₹0 draft (and a failed edit could drop existing lines).
-- SECURITY INVOKER: every statement still runs under the caller's RLS.
-- Only listed columns are written, so unknown keys can't break the insert.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.save_quotation(p_id uuid, p_org uuid, p_header jsonb, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_org uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one line item' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.quotations (organization_id, created_by, client_id, lead_id, project_id, title, description,
      issue_date, valid_until, tax_mode, payment_terms, terms, notes)
    values (p_org, auth.uid(), nullif(p_header->>'client_id', '')::uuid, nullif(p_header->>'lead_id', '')::uuid,
      nullif(p_header->>'project_id', '')::uuid, p_header->>'title', p_header->>'description',
      (p_header->>'issue_date')::date, nullif(p_header->>'valid_until', '')::date, (p_header->>'tax_mode')::public.tax_mode,
      p_header->>'payment_terms', p_header->>'terms', p_header->>'notes')
    returning id, organization_id into v_id, v_org;
  else
    update public.quotations set client_id = nullif(p_header->>'client_id', '')::uuid, lead_id = nullif(p_header->>'lead_id', '')::uuid,
      project_id = nullif(p_header->>'project_id', '')::uuid, title = p_header->>'title', description = p_header->>'description',
      issue_date = (p_header->>'issue_date')::date, valid_until = nullif(p_header->>'valid_until', '')::date,
      tax_mode = (p_header->>'tax_mode')::public.tax_mode, payment_terms = p_header->>'payment_terms', terms = p_header->>'terms', notes = p_header->>'notes'
    where id = p_id returning id, organization_id into v_id, v_org;
    if v_id is null then raise exception 'Quotation not found or you don''t have access to it.' using errcode = 'P0002'; end if;
    delete from public.quotation_items where quotation_id = v_id;
  end if;
  insert into public.quotation_items (organization_id, quotation_id, position, name, description, quantity, unit_price, discount_pct, tax_rate)
  select v_org, v_id, (i.n - 1)::int, i.e->>'name', i.e->>'description', (i.e->>'quantity')::numeric, (i.e->>'unit_price')::numeric,
    coalesce((i.e->>'discount_pct')::numeric, 0), coalesce((i.e->>'tax_rate')::numeric, 0)
  from jsonb_array_elements(p_items) with ordinality as i(e, n);
  return v_id;
end $$;

create or replace function public.save_invoice(p_id uuid, p_org uuid, p_header jsonb, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_org uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one line item' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.invoices (organization_id, created_by, client_id, project_id, milestone_id, invoice_date, due_date, tax_mode, notes, terms)
    values (p_org, auth.uid(), (p_header->>'client_id')::uuid, nullif(p_header->>'project_id', '')::uuid, nullif(p_header->>'milestone_id', '')::uuid,
      (p_header->>'invoice_date')::date, (p_header->>'due_date')::date, (p_header->>'tax_mode')::public.tax_mode, p_header->>'notes', p_header->>'terms')
    returning id, organization_id into v_id, v_org;
  else
    -- amounts are locked once money has been received
    if exists (select 1 from public.invoices where id = p_id and (amount_paid > 0 or status = 'cancelled')) then
      raise exception 'This invoice has payments or is cancelled, so it can''t be edited.' using errcode = '22023';
    end if;
    update public.invoices set client_id = (p_header->>'client_id')::uuid, project_id = nullif(p_header->>'project_id', '')::uuid,
      milestone_id = nullif(p_header->>'milestone_id', '')::uuid, invoice_date = (p_header->>'invoice_date')::date,
      due_date = (p_header->>'due_date')::date, tax_mode = (p_header->>'tax_mode')::public.tax_mode, notes = p_header->>'notes', terms = p_header->>'terms'
    where id = p_id returning id, organization_id into v_id, v_org;
    if v_id is null then raise exception 'Invoice not found or you don''t have access to it.' using errcode = 'P0002'; end if;
    delete from public.invoice_items where invoice_id = v_id;
  end if;
  insert into public.invoice_items (organization_id, invoice_id, position, name, description, hsn_sac, quantity, unit_price, discount_pct, tax_rate)
  select v_org, v_id, (i.n - 1)::int, i.e->>'name', i.e->>'description', nullif(i.e->>'hsn_sac', ''), (i.e->>'quantity')::numeric,
    (i.e->>'unit_price')::numeric, coalesce((i.e->>'discount_pct')::numeric, 0), coalesce((i.e->>'tax_rate')::numeric, 0)
  from jsonb_array_elements(p_items) with ordinality as i(e, n);
  return v_id;
end $$;

revoke execute on function public.save_quotation(uuid, uuid, jsonb, jsonb), public.save_invoice(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quotation(uuid, uuid, jsonb, jsonb), public.save_invoice(uuid, uuid, jsonb, jsonb) to authenticated;
