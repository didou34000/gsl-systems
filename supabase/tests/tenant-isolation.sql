-- Disposable fixtures: this entire check is rolled back, including Auth users.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','gsl-test-buyer@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','gsl-test-supplier@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','gsl-test-competitor@example.invalid');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.organizations(id,legal_name,country_code,entity_kind,buyer) values('20000000-0000-4000-8000-000000000001','Test Buyer','FR','company',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
insert into public.organizations(id,legal_name,country_code,entity_kind,supplier) values('20000000-0000-4000-8000-000000000002','Test Supplier','TR','company',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
insert into public.organizations(id,legal_name,country_code,entity_kind,supplier) values('20000000-0000-4000-8000-000000000003','Test Competitor','GE','company',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.rfqs(id,organization_id,title,state) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Sent RFQ','sent'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Private draft','draft');
insert into public.rfq_recipients(rfq_id,supplier_organization_id) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
insert into public.threads(id,rfq_id,supplier_organization_id) values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
insert into public.files(id,organization_id,object_path,original_name,mime_type,size_bytes,purpose,scan_status) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001','shared-plan.pdf','application/pdf',100,'drawing','clean'),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000002','private-registry.pdf','application/pdf',100,'registry','clean');
insert into public.rfq_files(organization_id,rfq_id,file_id) values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');
insert into public.offers(thread_id,supplier_organization_id,version,amount_minor,currency,quantity,unit,terms,lead_time_assumptions,valid_until)
 values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',1,10000,'EUR',10,'pieces','Test only','After review',current_date+30);
set local role authenticated;
do $$ begin
  if (select count(*) from public.organizations) <> 1 then raise exception 'Buyer company isolation failed'; end if;
  if (select count(*) from public.rfqs) <> 2 then raise exception 'Buyer RFQ access failed'; end if;
  if (select count(*) from public.offers) <> 1 then raise exception 'Buyer offer access failed'; end if;
  begin
    update public.rfqs set state='sent' where state='draft';
    raise exception 'Client could self-send';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.memberships(organization_id,user_id,role) values('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','owner');
    raise exception 'Client could grant membership';
  exception when insufficient_privilege then null; end;
end $$;
-- Check ordinary client creation, including RETURNING used by supabase-js.
insert into public.organizations(legal_name,country_code,entity_kind,buyer) values('Client created company','FR','company',true) returning id;
insert into public.rfqs(organization_id,title) values('20000000-0000-4000-8000-000000000001','Client-created draft') returning id;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.organizations) <> 1 then raise exception 'Supplier company isolation failed'; end if;
  if (select count(*) from public.rfqs) <> 1 then raise exception 'Supplier saw draft or missed sent request'; end if;
  if (select count(*) from public.offers) <> 1 then raise exception 'Supplier own offer hidden'; end if;
  if (select count(*) from public.files) <> 1 then raise exception 'Shared/private file separation failed'; end if;
  begin
    update public.files set scan_status='clean';
    raise exception 'Client could clear quarantine';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.evidence_documents(organization_id,file_id,kind,reference,issuer,scope_description)
      values('20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','registration','test','test','test');
    raise exception 'Cross-company evidence attachment allowed';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.messages(thread_id,sender_organization_id,body) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Impersonation');
    raise exception 'Message impersonation allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.published_supplier_profiles(organization_id,source_revision,display_name,country_code,city,description) values('20000000-0000-4000-8000-000000000002',1,'Fake badge','TR','Test','Test');
    raise exception 'Self-publication allowed';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.messages(thread_id,sender_organization_id,body) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','Legitimate supplier reply');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
  if exists(select 1 from public.rfqs) then raise exception 'Competitor saw RFQ'; end if;
  if exists(select 1 from public.offers) then raise exception 'Competitor saw offer'; end if;
  if exists(select 1 from public.messages) then raise exception 'Competitor saw messages'; end if;
end $$;
reset role;
-- Invite the competitor: it may see the shared request, but still not the first supplier's offer or messages.
insert into public.rfq_recipients(rfq_id,supplier_organization_id) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003');
set local role authenticated;
do $$ begin
  if (select count(*) from public.rfqs) <> 1 then raise exception 'Second recipient cannot see RFQ'; end if;
  if (select count(*) from public.rfq_recipients) <> 1 then raise exception 'Supplier sees competitor identity'; end if;
  if exists(select 1 from public.offers) or exists(select 1 from public.messages) then raise exception 'Invited competitor sees private negotiation'; end if;
end $$;
reset role;
update public.memberships set active=false where user_id='10000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.organizations) or exists(select 1 from public.rfqs) then raise exception 'Revoked member retained access'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform count(*) from public.files; raise exception 'Public private-file metadata access'; exception when insufficient_privilege then null; end;
end $$;
select count(*) as public_suppliers from public.published_supplier_profiles;
reset role;
select 'Tenant isolation, private drafts, competitive offers, impersonation, publication and revocation checks passed' as result;
rollback;
