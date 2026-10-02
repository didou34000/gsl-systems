-- Progressive profiles: optional enrichment and private updates to live listings.
-- Existing reviewer authorization, immutable submissions and publication projections remain in place.
create or replace function private.reopen_supplier(expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.supplier_applications;
begin
 select * into a from public.supplier_applications where owner_id=auth.uid() for update;
 if a.owner_id is null or a.revision is distinct from expected_revision or a.status not in ('reviewed','submitted','changes_requested') then raise exception 'CONFLICT';end if;
 if a.organization_id is not null then
  if not private.is_member(a.organization_id,array['owner','admin']) then raise exception 'FORBIDDEN';end if;
  -- Keep the last reviewed projection visible while editing its private draft.
 end if;
 update public.supplier_applications set status='draft' where owner_id=a.owner_id returning * into a;
 return jsonb_build_object('revision',a.revision,'status',a.status,'updated_at',a.updated_at);
end $$;

create or replace function private.snapshot_supplier_submission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='submitted' then
  if length(trim(coalesce(new.payload->>'legalName','')))<2 or coalesce(new.payload->>'country','')!~'^[A-Z]{2}$' or coalesce(new.payload->>'attestation','false')<>'true' then raise exception 'INCOMPLETE';end if;
  insert into public.supplier_submission_versions(owner_id,revision,payload,file_manifest)
  select new.owner_id,new.revision,new.payload,coalesce(jsonb_agg(jsonb_build_object('id',f.id,'kind',f.kind,'name',f.name,'size',f.size)),'[]')
  from public.supplier_application_files f where f.owner_id=new.owner_id;
 end if;return new;
end $$;

create or replace function private.workflow_base(action text,args jsonb,command uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid();result jsonb;app public.supplier_applications;r public.rfqs;t public.threads;
 org uuid;target uuid;thread_id uuid;product uuid;item jsonb;site jsonb;address_id uuid;total numeric=0;line_total numeric;exponent integer;ver integer;
begin
 if actor is null then raise exception 'LOGIN_REQUIRED';end if;
 if command is null or action is null or args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>180000 then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||command::text,0));
 select c.result into result from public.workflow_commands c where c.actor_id=actor and c.command_id=command and c.action=workflow_base.action;
 if result is not null then return result;end if;
 if action='buyer_company' then
  insert into public.organizations(legal_name,country_code,entity_kind,buyer) values(args->>'name',args->>'country','company',true) returning id into org;
  result=jsonb_build_object('organizationId',org);
 elsif action='review' then
  if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
  select * into app from public.supplier_applications where owner_id=(args->>'owner')::uuid for update;
  if app.owner_id is null or app.revision is distinct from (args->>'revision')::int or app.status not in ('submitted','in_review') then raise exception 'CONFLICT';end if;
  if length(trim(coalesce(args->>'feedback','')))<5 then raise exception 'FEEDBACK_REQUIRED';end if;
  if not exists(select 1 from public.review_assignments a where a.owner_id=app.owner_id and a.reviewer_id=actor and a.submission_revision=app.revision) then raise exception 'ASSIGNED_TO_ANOTHER_REVIEWER';end if;
  if args->>'decision'='changes_requested' then
   update public.supplier_applications set status='changes_requested',reviewer_notes=args->>'feedback' where owner_id=app.owner_id;
  elsif args->>'decision'='reject' then
   update public.supplier_applications set status='rejected',reviewer_notes=args->>'feedback' where owner_id=app.owner_id;
  elsif args->>'decision'='publish' then
   if not exists(select 1 from public.review_assignments a where a.owner_id=app.owner_id and a.reviewer_id=actor and a.submission_revision=app.revision and a.identity_checked and a.scope_checked and a.privacy_checked) then raise exception 'REVIEW_CHECKS_REQUIRED';end if;
   if not exists(select 1 from public.supplier_submission_versions where owner_id=app.owner_id and revision=app.revision) then raise exception 'SUBMISSION_REQUIRED';end if;
   if app.organization_id is not null then
    org=app.organization_id;
    if not exists(select 1 from public.memberships where organization_id=org and user_id=app.owner_id and active and role in ('owner','admin')) then raise exception 'FORBIDDEN';end if;
    update public.organizations set legal_name=app.payload->>'legalName',trading_name=coalesce(app.payload->>'tradingName',''),country_code=app.payload->>'country',entity_kind=app.payload->>'entityKind',legal_form=coalesce(app.payload->>'legalForm',''),description=app.payload->>'description',website=nullif(app.payload->>'website',''),supplier=true where id=org;
   else
   insert into public.organizations(created_by,legal_name,trading_name,country_code,entity_kind,legal_form,description,website,supplier)
    values(app.owner_id,app.payload->>'legalName',coalesce(app.payload->>'tradingName',''),app.payload->>'country',app.payload->>'entityKind',coalesce(app.payload->>'legalForm',''),app.payload->>'description',nullif(app.payload->>'website',''),true) returning id into org;
   end if;
   insert into public.addresses(organization_id,kind,line1,city,region,postal_code,country_code)
    values(org,'registered_office',app.payload#>>'{headquarters,line}',app.payload#>>'{headquarters,city}',coalesce(app.payload#>>'{headquarters,region}',''),coalesce(app.payload#>>'{headquarters,postalCode}',''),app.payload->>'country') on conflict(organization_id) where kind='registered_office' do update set line1=excluded.line1,city=excluded.city,region=excluded.region,postal_code=excluded.postal_code,country_code=excluded.country_code;
   perform private.claim_company_identity(app.payload,org);
   update public.production_sites set retired_at=now() where organization_id=org and retired_at is null;
   update public.capabilities set retired_at=now() where organization_id=org and retired_at is null;
   for site in select value from jsonb_array_elements(coalesce(app.payload->'sites','[]')) loop
    insert into public.addresses(organization_id,kind,line1,city,region,postal_code,country_code)
     values(org,'production',site#>>'{address,line}',site#>>'{address,city}',coalesce(site#>>'{address,region}',''),coalesce(site#>>'{address,postalCode}',''),site#>>'{address,country}') returning id into address_id;
    insert into public.production_sites(organization_id,address_id,name,relationship) values(org,address_id,site->>'name',case when site->>'relationship'='partner' then 'subcontracted' else site->>'relationship' end);
   end loop;
   insert into public.capabilities(organization_id,process,materials,description,equipment)
    values(org,coalesce(app.payload#>>'{capabilities,processes}',''),string_to_array(coalesce(app.payload#>>'{capabilities,materials}',''),','),app.payload->>'description',coalesce(app.payload#>>'{capabilities,equipment}',''));
   for item in select value from jsonb_array_elements(coalesce(app.payload->'products','[]')) where coalesce(value->>'listingStatus','publish')='publish' loop
    insert into public.products(organization_id,name,model_reference,category,description,specifications)
     values(org,item->>'name',coalesce(nullif(item->>'reference',''),item->>'id'),item->>'category',item->>'description',jsonb_build_object('materials',item->>'materials','processes',item->>'processes','minimum_quantity',item->>'moq','unit',item->>'unit','manufacturing_country',item->>'origin','compliance','not_assessed')) on conflict(organization_id,model_reference) do update set name=excluded.name,category=excluded.category,description=excluded.description,specifications=excluded.specifications returning id into product;
    insert into public.published_products(product_id,organization_id,source_revision,name,category,description,specifications)
     select id,organization_id,revision,name,category,description,specifications from public.products where id=product on conflict(product_id) do update set source_revision=excluded.source_revision,name=excluded.name,category=excluded.category,description=excluded.description,specifications=excluded.specifications,published_at=now(),withdrawn_at=null;
   end loop;
   -- Publish LAST: related-data triggers withdraw any previous projection.
   insert into public.published_supplier_profiles(organization_id,source_revision,display_name,country_code,city,description,processes,materials,manufacturing_countries,public_details)
    select org,o.revision,coalesce(nullif(app.payload->>'tradingName',''),app.payload->>'legalName'),app.payload->>'country',app.payload#>>'{headquarters,city}',app.payload->>'description',string_to_array(coalesce(app.payload#>>'{capabilities,processes}',''),','),string_to_array(coalesce(app.payload#>>'{capabilities,materials}',''),','),array(select distinct s.value#>>'{address,country}' from jsonb_array_elements(coalesce(app.payload->'sites','[]')) s),jsonb_build_object('activity',app.payload->>'activity','website',app.payload->>'website','equipment',app.payload#>>'{capabilities,equipment}','quality',app.payload#>>'{capabilities,quality}','languages',app.payload#>>'{contact,languages}','sites',(select coalesce(jsonb_agg(jsonb_build_object('name',v->>'name','city',v#>>'{address,city}','country',v#>>'{address,country}','relationship',v->>'relationship')),'[]') from jsonb_array_elements(coalesce(app.payload->'sites','[]')) v)) from public.organizations o where o.id=org on conflict(organization_id) do update set source_revision=excluded.source_revision,display_name=excluded.display_name,country_code=excluded.country_code,city=excluded.city,description=excluded.description,processes=excluded.processes,materials=excluded.materials,manufacturing_countries=excluded.manufacturing_countries,public_details=excluded.public_details,published_at=now(),withdrawn_at=null;
   update public.supplier_applications set status='reviewed',organization_id=org,reviewer_notes=args->>'feedback' where owner_id=app.owner_id;
  else raise exception 'INVALID_DECISION';end if;
  insert into public.supplier_review_decisions(owner_id,revision,reviewer_id,decision,feedback) values(app.owner_id,app.revision,actor,args->>'decision',args->>'feedback');
  insert into public.notification_outbox(event_key,recipient_id,template,resource_id) values(command::text,app.owner_id,'review_decision',app.owner_id);
  result=jsonb_build_object('organizationId',org,'saved',true);
 elsif action='withdraw' then
  if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
  org=(args->>'organization')::uuid;
  update public.published_supplier_profiles set withdrawn_at=now() where organization_id=org;
  update public.published_products set withdrawn_at=now() where organization_id=org;
  result=jsonb_build_object('withdrawn',true);
 elsif action='save_rfq' then
  org=(args->>'organization')::uuid;
  if not private.is_member(org,array['owner','admin','procurement']) or not exists(select 1 from public.organizations where id=org and buyer) then raise exception 'FORBIDDEN';end if;
  if args->>'id' is null then
   insert into public.rfqs(organization_id,title,details,destination_country) values(org,coalesce(args->>'title',''),coalesce(args->>'details',''),nullif(args->>'destination','')) returning * into r;
  else
   select * into r from public.rfqs where id=(args->>'id')::uuid and organization_id=org for update;
   if r.id is null or r.state<>'draft' or r.revision is distinct from (args->>'revision')::int then raise exception 'CONFLICT';end if;
   update public.rfqs set title=coalesce(args->>'title',''),details=coalesce(args->>'details',''),destination_country=nullif(args->>'destination','') where id=r.id returning * into r;
  end if;
  if jsonb_typeof(coalesce(args->'items','[]'))<>'array' or jsonb_array_length(coalesce(args->'items','[]'))>50 then raise exception 'INVALID';end if;
  update public.rfqs set draft_items=coalesce(args->'items','[]') where id=r.id returning * into r;
  delete from public.rfq_items where rfq_id=r.id;
  for item in select value from jsonb_array_elements(coalesce(args->'items','[]')) loop
   if nullif(item->>'product','') is not null and not exists(select 1 from public.published_products where product_id=(item->>'product')::uuid and withdrawn_at is null) then raise exception 'NOT_PUBLISHED';end if;
   if coalesce(item->>'quantity','')!~'^[0-9]+([.][0-9]+)?$' then continue;end if;
   if (item->>'quantity')::numeric<=0 or length(trim(coalesce(item->>'description','')))=0 or length(trim(coalesce(item->>'unit','')))=0 then continue;end if;
   insert into public.rfq_items(organization_id,rfq_id,description,quantity,unit,selected_product_id) values(org,r.id,item->>'description',(item->>'quantity')::numeric,item->>'unit',nullif(item->>'product','')::uuid);
  end loop;
  result=jsonb_build_object('id',r.id,'revision',r.revision);
 elsif action='send_rfq' then
  select * into r from public.rfqs where id=(args->>'id')::uuid for update;
  if r.id is null or not private.is_member(r.organization_id,array['owner','admin','procurement']) then raise exception 'FORBIDDEN';end if;
  if r.state<>'draft' or r.revision is distinct from (args->>'revision')::int then raise exception 'CONFLICT';end if;
  if length(trim(r.title))<3 or length(trim(r.details))<20 or r.destination_country is null or not exists(select 1 from public.rfq_items where rfq_id=r.id) or jsonb_array_length(r.draft_items)<>(select count(*) from public.rfq_items where rfq_id=r.id) then raise exception 'INCOMPLETE';end if;
  if jsonb_typeof(args->'recipients') is distinct from 'array' or coalesce(jsonb_array_length(args->'recipients'),0) not between 1 and 5 then raise exception 'RECIPIENTS_REQUIRED';end if;
  if exists(select 1 from public.rfq_items i left join public.published_products p on p.product_id=i.selected_product_id where i.rfq_id=r.id and i.selected_product_id is not null and (p.product_id is null or p.withdrawn_at is not null or not (args->'recipients') ? p.organization_id::text)) then raise exception 'NOT_PUBLISHED';end if;
  for target in select distinct value::uuid from jsonb_array_elements_text(args->'recipients') loop
   -- Lock publications against concurrent withdrawal until the send commits.
   perform 1 from public.published_supplier_profiles where organization_id=target and withdrawn_at is null for share;
   if not found or target=r.organization_id then raise exception 'NOT_PUBLISHED';end if;
   insert into public.rfq_recipients(rfq_id,supplier_organization_id) values(r.id,target);
   insert into public.threads(rfq_id,supplier_organization_id) values(r.id,target) returning id into thread_id;
   insert into public.notification_outbox(event_key,recipient_id,template,resource_id)
    select command::text||':'||m.user_id::text,m.user_id,'new_rfq',thread_id from public.memberships m where m.organization_id=target and m.active and m.role in ('owner','admin','sales');
  end loop;
  update public.rfqs set state='sent',sent_snapshot=jsonb_build_object('title',title,'details',details,'destination',destination_country,'items',(select jsonb_agg(to_jsonb(i)-'organization_id') from public.rfq_items i where rfq_id=r.id)) where id=r.id;
  result=jsonb_build_object('id',r.id,'state','sent','email','pending');
 elsif action='message' then
  select * into t from public.threads where id=(args->>'thread')::uuid;
  org=(args->>'organization')::uuid;
  if t.id is null or not private.can_read_thread(t.id) or not private.is_member(org,array['owner','admin','sales','procurement']) then raise exception 'FORBIDDEN';end if;
  select * into r from public.rfqs where id=t.rfq_id;
  if org is null or org not in (t.supplier_organization_id,r.organization_id) or (org=r.organization_id and not private.is_member(org,array['owner','admin','procurement'])) or (org=t.supplier_organization_id and not private.is_member(org,array['owner','admin','sales'])) then raise exception 'FORBIDDEN';end if;
  insert into public.messages(thread_id,sender_organization_id,sender_user_id,body) values(t.id,org,actor,args->>'body') returning id into target;
  result=jsonb_build_object('id',target);
 elsif action='offer' then
  select * into t from public.threads where id=(args->>'thread')::uuid for update;
  if t.id is null or not private.can_read_thread(t.id) or not private.is_member(t.supplier_organization_id,array['owner','admin','sales']) then raise exception 'FORBIDDEN';end if;
  -- Explicit supported currencies. No guessed exponent for unconfigured currency.
  exponent=case when args->>'currency' in ('JPY','KRW') then 0 when args->>'currency' in ('BHD','KWD','TND') then 3 when args->>'currency' in ('EUR','USD','GBP','CNY','TRY','GEL','MAD','CHF','CAD','AUD','PLN','RON') then 2 else null end;
  if exponent is null or jsonb_typeof(args->'lines') is distinct from 'array' or coalesce(jsonb_array_length(args->'lines'),0) not between 1 and 50 or (args->>'validUntil') is null or (args->>'validUntil')::date<current_date then raise exception 'INVALID_OFFER';end if;
  for item in select value from jsonb_array_elements(args->'lines') loop
   if coalesce((item->>'quantity')::numeric,0)<=0 or (item->>'unitPriceMinor') is null or coalesce(item->>'unit','')='' or (item->>'unitPriceMinor')!~'^[0-9]{1,16}$' then raise exception 'INVALID_LINE';end if;
   line_total=(item->>'quantity')::numeric*(item->>'unitPriceMinor')::numeric;
   if line_total<>trunc(line_total) then raise exception 'FRACTIONAL_MINOR_UNIT';end if;
   total=total+line_total;
  end loop;
  if coalesce(args->>'fixedFeeMinor','0')!~'^[0-9]{1,16}$' then raise exception 'INVALID_OFFER';end if;
  total=total+coalesce((args->>'fixedFeeMinor')::numeric,0);
  if total>9007199254740991 then raise exception 'AMOUNT_TOO_LARGE';end if;
  select coalesce(max(version),0)+1 into ver from public.offers o where o.thread_id=t.id;
  insert into public.offers(thread_id,supplier_organization_id,version,amount_minor,currency,quantity,unit,terms,lead_time_assumptions,valid_until,lines,transport,exclusions,currency_decimals,fixed_fee_minor)
   values(t.id,t.supplier_organization_id,ver,total::bigint,args->>'currency',1,'offer',args->>'terms',args->>'leadTime',(args->>'validUntil')::date,args->'lines',coalesce(args->>'transport','unknown'),coalesce(args->>'exclusions',''),exponent,coalesce((args->>'fixedFeeMinor')::bigint,0)) returning id into target;
  result=jsonb_build_object('id',target,'totalMinor',total::text,'version',ver);
 else raise exception 'UNKNOWN_ACTION';end if;
 insert into public.workflow_commands(actor_id,command_id,action,result) values(actor,command,action,result);
 return result;
end $$;
