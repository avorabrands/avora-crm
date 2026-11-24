-- ════════════════════════════════════════════════════════════════════════
-- AVORA CRM — local/staging seed (SQL version of scripts/seed.mjs)
-- Creates test auth users (shared test password below), the Avora Brands org
-- and sample data. NEVER run against production. Re-running is a no-op.
-- ════════════════════════════════════════════════════════════════════════
do $seed$
declare
  pw constant text := 'AvoraTest#2026';   -- local test password (docs/SETUP.md)
  v_org uuid; u_admin uuid; u_mgr uuid; u_d1 uuid; u_d2 uuid; u_client uuid;
  c_lumi uuid; c_vyd uuid; c_bloom uuid; p_course uuid; p_brand uuid;
  q1 uuid; q2 uuid; q3 uuid; i1 uuid; i2 uuid; i3 uuid; l_green uuid;
  r record; a_id uuid; i int;
  courses text[] := array['B.Sc Nursing','GNM Nursing','Post Basic B.Sc Nursing','M.Sc Nursing','BPT Physiotherapy','MPT Physiotherapy','B.Pharm','D.Pharm','Pharm.D','M.Pharm',
    'BMLT','B.Sc Radiology','B.Sc Anaesthesia Technology','B.Sc Cardiac Care','B.Sc Dialysis Technology','B.Sc Optometry','B.Sc Operation Theatre Tech','B.Sc Respiratory Care',
    'BHA Hospital Administration','MHA Hospital Administration','MBA Healthcare Management','BBA Aviation','BCA','B.Com','BBA','B.Sc Psychology','M.Sc Clinical Psychology',
    'B.Sc Nutrition & Dietetics','B.Sc Forensic Science','B.Sc Microbiology','B.Sc Biotechnology','MBBS Counselling Desk','Bridge Course - Biology','Foundation Programme'];
  st text;
begin
  if exists (select 1 from public.organizations where slug = 'avora-brands') then
    raise notice 'Already seeded'; return;
  end if;

  -- ── auth users (GoTrue-compatible rows) ──────────────────────────────
  for r in select * from (values
      ('admin@avora.test','Praveen (Owner)'), ('manager@avora.test','Meera Iyer'), ('designer@avora.test','Arjun Rao'),
      ('designer2@avora.test','Sana Khan'), ('client@lumiedu.test','Dr. Kavya (LumiEdu)')) as t(email, name) loop
    if not exists (select 1 from auth.users where email = r.email) then
      a_id := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000', a_id, 'authenticated', 'authenticated', r.email, extensions.crypt(pw, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', r.name), now(), now(), '', '', '', '', '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), a_id, a_id::text, jsonb_build_object('sub', a_id::text, 'email', r.email, 'email_verified', true), 'email', now(), now(), now());
    end if;
  end loop;
  select id into u_admin from auth.users where email = 'admin@avora.test';
  select id into u_mgr from auth.users where email = 'manager@avora.test';
  select id into u_d1 from auth.users where email = 'designer@avora.test';
  select id into u_d2 from auth.users where email = 'designer2@avora.test';
  select id into u_client from auth.users where email = 'client@lumiedu.test';

  -- ── org & settings ───────────────────────────────────────────────────
  insert into public.organizations (name, slug) values ('Avora Brands', 'avora-brands') returning id into v_org;
  insert into public.company_settings (organization_id, company_name, legal_name, state, address, gstin, email, phone, bank_details, default_terms)
  values (v_org, 'Avora Brands', 'Avora Brands (sample legal name)', 'Karnataka', 'Sample address - update in Settings', '29ABCDE1234F1Z5',
    'accounts@avora.test', '+91 90000 00000', E'Bank: Sample Bank\nA/c: 000000000000\nIFSC: SAMP0000001',
    'Prices are exclusive of printing unless stated. Two rounds of revisions included per deliverable.');

  -- ── clients & members ────────────────────────────────────────────────
  insert into public.clients (organization_id, company_name, contact_person, email, phone, billing_address, state, gstin, category, account_manager_id, notes)
  values (v_org, 'LumiEdu', 'Dr. Kavya', 'client@lumiedu.test', '+91 98450 11111', 'Bengaluru, Karnataka', 'Karnataka', '29LUMIE1234F1Z2', 'Education', u_mgr,
          'Prefers WhatsApp updates. Budget-conscious; approvals go via Dean.') returning id into c_lumi;
  insert into public.clients (organization_id, company_name, contact_person, email, phone, billing_address, state, category, account_manager_id)
  values (v_org, 'Vydehi Institute', 'Rahul Menon', 'rahul@vydehi.test', '+91 98450 22222', 'Whitefield, Bengaluru', 'Karnataka', 'Education', u_mgr) returning id into c_vyd;
  insert into public.clients (organization_id, company_name, contact_person, email, billing_address, state, category, account_manager_id)
  values (v_org, 'Bloom Organics', 'Nisha Patel', 'nisha@bloom.test', 'Ahmedabad, Gujarat', 'Gujarat', 'Retail', u_admin) returning id into c_bloom;

  insert into public.organization_members (organization_id, user_id, role, client_id, department, designation, employee_code, joining_date) values
    (v_org, u_admin, 'admin', null, 'Leadership', 'Founder', 'AVB-001', current_date - 400),
    (v_org, u_mgr, 'manager', null, 'Accounts', 'Account Manager', 'AVB-002', current_date - 400),
    (v_org, u_d1, 'team_member', null, 'Design', 'Senior Designer', 'AVB-003', current_date - 400),
    (v_org, u_d2, 'team_member', null, 'Design', 'Designer', 'AVB-004', current_date - 400),
    (v_org, u_client, 'client', c_lumi, null, null, null, null);

  -- ── leads & pipeline ─────────────────────────────────────────────────
  insert into public.leads (organization_id, company_name, contact_person, status, source, estimated_budget, services, location, next_follow_up, assigned_to, created_by, email, converted_client_id, converted_at) values
    (v_org, 'Northstar Clinics', 'Dr. Anil', 'new', 'Website', 150000, '{Brand Identity,Website}', 'Bengaluru', current_date + 2, null, u_mgr, 'northstar@example.test', null, null),
    (v_org, 'Kaveri Realty', 'Priya S', 'contacted', 'Referral', 300000, '{Digital Marketing,Social Media}', 'Bengaluru', current_date + 1, u_d2, u_mgr, 'kaveri@example.test', null, null),
    (v_org, 'TechNest Labs', 'Rohit', 'discussion', 'LinkedIn', 220000, '{UI/UX Design}', 'Bengaluru', current_date - 1, u_mgr, u_mgr, 'technest@example.test', null, null),
    (v_org, 'Spice Route Cafe', 'Fatima', 'requirement_received', 'Instagram', 60000, '{Graphic Design,Print}', 'Bengaluru', current_date + 3, u_mgr, u_mgr, 'spice@example.test', null, null),
    (v_org, 'GreenLeaf School', 'Mr. Joseph', 'quotation_sent', 'Event', 180000, '{Print,Graphic Design}', 'Bengaluru', current_date + 5, u_mgr, u_mgr, 'greenleaf@example.test', null, null),
    (v_org, 'Urban Threads', 'Kiran', 'negotiation', 'Google Ads', 400000, '{Brand Identity,Packaging}', 'Bengaluru', current_date, u_admin, u_mgr, 'urban@example.test', null, null),
    (v_org, 'Vydehi Institute', 'Rahul Menon', 'won', 'Referral', 250000, '{Graphic Design}', 'Bengaluru', null, u_mgr, u_mgr, 'rahul@vydehi.test', c_vyd, now()),
    (v_org, 'Old Mill Furniture', 'Suresh', 'lost', 'Cold outreach', 90000, '{Website}', 'Bengaluru', null, u_mgr, u_mgr, 'oldmill@example.test', null, null);
  select id into l_green from public.leads where organization_id = v_org and company_name = 'GreenLeaf School';
  insert into public.lead_activities (organization_id, lead_id, type, content, created_by)
    select v_org, id, 'call', 'Intro call with ' || company_name || '. Shared portfolio; awaiting brief.', u_mgr
    from public.leads where organization_id = v_org and status in ('contacted','discussion','requirement_received','quotation_sent','negotiation');
  insert into public.opportunities (organization_id, lead_id, client_id, title, value, stage, assigned_to, expected_close_date, position)
    select v_org, l.id, l.converted_client_id, l.company_name || ' engagement', l.estimated_budget,
      (case l.status when 'contacted' then 'new' when 'requirement_received' then 'discussion' else l.status::text end)::public.opportunity_stage,
      l.assigned_to, current_date + 10 + (row_number() over (order by l.created_at))::int * 4, row_number() over (order by l.created_at)
    from public.leads l where l.organization_id = v_org;

  -- ── projects ─────────────────────────────────────────────────────────
  insert into public.projects (organization_id, name, client_id, category, description, start_date, due_date, budget, manager_id, priority, status, created_by)
  values (v_org, 'Course Creative Design', c_lumi, 'graphic_design', 'Individual brochure design for 34 courses (LumiEdu x Vydehi programmes).',
          current_date - 30, current_date + 20, 85000, u_mgr, 'high', 'in_progress', u_admin) returning id into p_course;
  insert into public.projects (organization_id, name, client_id, category, description, start_date, due_date, budget, manager_id, priority, status, created_by)
  values (v_org, 'Bloom Organics Brand Identity', c_bloom, 'brand_identity', 'Logo, colour system, typography and packaging guidelines.',
          current_date - 50, current_date - 3, 140000, u_admin, 'medium', 'client_review', u_admin) returning id into p_brand;
  insert into public.project_financials (project_id, organization_id, estimated_cost, actual_cost) values (p_course, v_org, 42000, 0), (p_brand, v_org, 61000, 58000);
  insert into public.project_members (project_id, user_id, organization_id, role_label) values
    (p_course, u_d1, v_org, 'Lead designer'), (p_course, u_d2, v_org, 'Designer'), (p_brand, u_d1, v_org, 'Brand designer');
  insert into public.project_milestones (organization_id, project_id, title, due_date, amount, status, position) values
    (v_org, p_course, 'Content received for all courses', current_date - 10, null, 'completed', 0),
    (v_org, p_course, 'First drafts - all 34 brochures', current_date + 7, 42500, 'in_progress', 1),
    (v_org, p_course, 'Final print-ready files', current_date + 20, 42500, 'pending', 2);

  -- 34 course deliverables spread across every stage
  for i in 1..array_length(courses, 1) loop
    st := case when i <= 9 then 'approved' when i <= 13 then 'client' when i <= 16 then 'revision' when i <= 21 then 'internal'
               when i <= 27 then 'design' when i <= 31 then 'content' else 'none' end;
    insert into public.deliverables (organization_id, project_id, name, position, assigned_to, content_received, content_received_at, design_status,
      internal_review_status, client_review_status, approval_status, revision_count, submitted_at, final_delivered_at, client_visible)
    values (v_org, p_course, courses[i], i, case when i % 2 = 0 then u_d2 else u_d1 end,
      st <> 'none', case when st <> 'none' then current_date - 20 end,
      (case when st in ('approved','client','revision','internal') then 'completed' when st = 'design' then 'in_progress' else 'not_started' end)::public.design_status,
      (case when st in ('approved','client','revision') then 'approved' when st = 'internal' then 'pending' else 'not_started' end)::public.review_status,
      (case st when 'approved' then 'approved' when 'client' then 'pending' when 'revision' then 'changes_requested' else 'not_started' end)::public.review_status,
      (case st when 'approved' then 'approved' when 'revision' then 'revision_requested' else 'pending' end)::public.approval_status,
      case when st = 'revision' or i <= 3 then 1 else 0 end,
      case when st in ('approved','client','revision') then current_date - 5 end,
      case when i <= 4 then current_date - 1 end,
      st in ('approved','client','revision'));
  end loop;
  insert into public.approvals (organization_id, deliverable_id, decision, comment, decided_by)
    select v_org, id, 'approved', 'Looks good, approved.', u_client from public.deliverables where project_id = p_course and approval_status = 'approved';
  for r in select id from public.deliverables where project_id = p_course and client_review_status = 'changes_requested' loop
    insert into public.approvals (organization_id, deliverable_id, decision, comment, decided_by)
      values (v_org, r.id, 'revision_requested', 'Please update the fee table and use the new campus photo.', u_client) returning id into a_id;
    insert into public.revisions (organization_id, deliverable_id, approval_id, revision_number, notes, requested_by)
      values (v_org, r.id, a_id, 1, 'Please update the fee table and use the new campus photo.', u_client);
  end loop;

  insert into public.tasks (organization_id, project_id, title, assigned_to, priority, due_date, status, created_by) values
    (v_org, p_course, 'Collect pending course content (3 courses)', u_mgr, 'high', current_date - 2, 'in_progress', u_mgr),
    (v_org, p_course, 'Brochure master template v2', u_d1, 'medium', current_date + 1, 'internal_review', u_mgr),
    (v_org, p_course, 'Apply revisions - Radiology, Anaesthesia, Cardiac Care', u_d2, 'urgent', current_date + 2, 'todo', u_mgr),
    (v_org, p_course, 'Print vendor quotes for 34 brochures', u_mgr, 'low', current_date + 12, 'todo', u_mgr),
    (v_org, p_brand, 'Logo concepts - round 2', u_d1, 'high', current_date - 4, 'completed', u_admin),
    (v_org, p_brand, 'Packaging mockups', u_d1, 'medium', current_date - 1, 'in_progress', u_admin);

  -- ── finance ──────────────────────────────────────────────────────────
  insert into public.quotations (organization_id, client_id, project_id, title, issue_date, valid_until, status, sent_at, responded_at, payment_terms, created_by)
  values (v_org, c_lumi, p_course, 'Course brochure design - 34 programmes', current_date - 35, current_date - 5, 'accepted', now() - interval '34 days', now() - interval '32 days',
          '50% advance, 50% on final delivery.', u_mgr) returning id into q1;
  insert into public.quotation_items (organization_id, quotation_id, position, name, quantity, unit_price, discount_pct, tax_rate)
  values (v_org, q1, 0, 'Course brochure design (4 pages)', 34, 2500, 0, 18);
  insert into public.quotations (organization_id, lead_id, title, valid_until, status, created_by)
  values (v_org, l_green, 'Annual print collateral', current_date + 20, 'draft', u_mgr) returning id into q2;
  insert into public.quotation_items (organization_id, quotation_id, position, name, quantity, unit_price, tax_rate) values
    (v_org, q2, 0, 'Prospectus design', 1, 45000, 18), (v_org, q2, 1, 'Printing - 2000 copies', 2000, 38, 12);
  insert into public.quotations (organization_id, client_id, project_id, title, valid_until, status, tax_mode, sent_at, created_by)
  values (v_org, c_bloom, p_brand, 'Packaging extension - 6 SKUs', current_date + 14, 'sent', 'inter_state', now(), u_admin) returning id into q3;
  insert into public.quotation_items (organization_id, quotation_id, position, name, quantity, unit_price, discount_pct, tax_rate)
  values (v_org, q3, 0, 'Packaging design per SKU', 6, 9000, 5, 18);

  insert into public.invoices (organization_id, client_id, project_id, quotation_id, invoice_date, due_date, status, notes, created_by)
  values (v_org, c_lumi, p_course, q1, current_date - 30, current_date - 20, 'unpaid', 'Advance - 50% of quotation', u_mgr) returning id into i1;
  insert into public.invoice_items (organization_id, invoice_id, position, name, hsn_sac, quantity, unit_price, tax_rate)
  values (v_org, i1, 0, 'Advance: course brochure design (50%)', '998391', 1, 42500, 18);
  insert into public.invoices (organization_id, client_id, project_id, invoice_date, due_date, status, tax_mode, created_by)
  values (v_org, c_bloom, p_brand, current_date - 25, current_date - 10, 'unpaid', 'inter_state', u_admin) returning id into i2;
  insert into public.invoice_items (organization_id, invoice_id, position, name, hsn_sac, quantity, unit_price, tax_rate)
  values (v_org, i2, 0, 'Brand identity - milestone 1', '998391', 1, 70000, 18);
  insert into public.invoices (organization_id, client_id, invoice_date, due_date, status, created_by)
  values (v_org, c_vyd, current_date - 3, current_date + 12, 'draft', u_mgr) returning id into i3;
  insert into public.invoice_items (organization_id, invoice_id, position, name, quantity, unit_price, tax_rate)
  values (v_org, i3, 0, 'Social media creatives (12)', 12, 1800, 18);

  insert into public.payments (organization_id, client_id, invoice_id, amount, payment_date, method, payment_type, transaction_id, reference_number, recorded_by) values
    (v_org, c_lumi, i1, 50150, current_date - 28, 'bank_transfer', 'advance', 'UTR0000001', null, u_admin),
    (v_org, c_bloom, i2, 40000, current_date - 12, 'upi', 'partial', 'UPI0000002', null, u_admin),
    (v_org, c_vyd, null, 15000, current_date - 60, 'cheque', 'advance', null, 'CHQ 104455', u_admin);

  insert into public.activity_logs (organization_id, actor_id, entity_type, entity_id, action, summary, client_id, project_id, client_visible) values
    (v_org, u_mgr, 'project', p_course, 'sent_for_review', '4 course brochures shared for your review', c_lumi, p_course, true),
    (v_org, u_admin, 'payment', null, 'recorded', 'Advance payment of Rs 50,150 received', c_lumi, p_course, true);

  raise notice 'Seeded Avora Brands %', v_org;
end $seed$;
