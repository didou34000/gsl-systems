alter table public.supplier_applications drop constraint supplier_applications_status_check;
alter table public.supplier_applications add constraint supplier_applications_status_check check(status in ('draft','submitted','in_review','changes_requested','reviewed','rejected'));
alter table public.published_supplier_profiles add column public_details jsonb not null default '{}';
-- Public search reads approved projections under the caller's RLS only.
create function public.catalogue_token(v text) returns text language sql immutable security invoker set search_path='' as $$
 select replace(replace(replace(replace(replace(replace(lower(coalesce(v,'')),'usinage','cnc'),'machining','cnc'),'aluminum','aluminium'),'soudage','weld'),'welding','weld'),'stainless steel','inox')
$$;
create index published_product_text on public.published_products using gin(to_tsvector('simple',public.catalogue_token(name||' '||description||' '||specifications::text)));
create function public.search_catalogue(criteria jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
with items as (
 select s.organization_id,s.display_name,s.country_code,s.city,s.description,s.published_at,p.product_id,p.name,p.category,p.specifications,
 least(
 case when coalesce(criteria->>'process','')='' then 1 when coalesce(p.specifications->>'processes','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'processes'),public.catalogue_token(criteria->>'process'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'material','')='' then 1 when coalesce(p.specifications->>'materials','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'materials'),public.catalogue_token(criteria->>'material'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'country','')='' then 1 when coalesce(p.specifications->>'manufacturing_country','')='' then 0 when criteria->>'country'='EU' and p.specifications->>'manufacturing_country'=any(array['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']) then 1 when p.specifications->>'manufacturing_country'=criteria->>'country' then 1 else -1 end,
 case when coalesce(criteria->>'quantity','')='' then 1 when coalesce(p.specifications->>'minimum_quantity','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(p.specifications->>'unit','')='' then 0 when p.specifications->>'unit'<>criteria->>'unit' then 0 when (p.specifications->>'minimum_quantity')::numeric <= nullif(criteria->>'quantity','')::numeric then 1 else -1 end
 ) as fit
 from public.published_products p join public.published_supplier_profiles s using(organization_id)
 where p.withdrawn_at is null and s.withdrawn_at is null
 and (coalesce(criteria->>'q','')='' or to_tsvector('simple',public.catalogue_token(p.name||' '||p.description||' '||p.specifications::text)) @@ plainto_tsquery('simple',public.catalogue_token(left(criteria->>'q',120))) or strpos(lower(s.display_name),lower(left(criteria->>'q',120)))>0)
 and (coalesce(criteria->>'category','')='' or p.category=criteria->>'category')
), best as (select organization_id,max(fit) as fit from items group by organization_id), grouped as (
 select i.organization_id,i.display_name,i.country_code,i.city,i.description,i.published_at,b.fit,
 case b.fit when 1 then 'confirmed' when 0 then 'unknown' else 'preferred_unmatched' end as match_group,
 jsonb_agg(jsonb_build_object('product_id',i.product_id,'name',i.name,'category',i.category,'specifications',i.specifications) order by i.name) as matched_products
 from items i join best b on i.organization_id=b.organization_id and i.fit=b.fit
 where b.fit=1 or (b.fit=0 and criteria->>'unknown'='include') or criteria->>'priority'='preferred'
 group by i.organization_id,i.display_name,i.country_code,i.city,i.description,i.published_at,b.fit
), paged as (select * from grouped order by fit desc,published_at desc,organization_id limit 12 offset (greatest(1,least(10000,coalesce((criteria->>'page')::int,1)))-1)*12)
select jsonb_build_object('suppliers',coalesce((select jsonb_agg(to_jsonb(p)-'fit') from paged p),'[]'),'count',(select count(*) from grouped),'page',greatest(1,coalesce((criteria->>'page')::int,1)))
$$;
revoke all on function public.catalogue_token(text),public.search_catalogue(jsonb) from public;
grant execute on function public.catalogue_token(text),public.search_catalogue(jsonb) to anon,authenticated;

alter table public.rfqs add column draft_items jsonb not null default '[]';
alter table public.offers add column fixed_fee_minor bigint not null default 0 check(fixed_fee_minor>=0);
create table public.offer_selections (
 rfq_id uuid primary key references public.rfqs(id),offer_id uuid not null references public.offers(id),
 selected_by uuid not null references auth.users(id),selected_at timestamptz not null default now()
);
create table public.workflow_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 actor_id uuid not null references auth.users(id),action text not null,resource_id uuid not null,created_at timestamptz not null default now()
);
alter table public.offer_selections enable row level security;
alter table public.workflow_events enable row level security;
revoke all on public.offer_selections,public.workflow_events from anon,authenticated;
grant select on public.offer_selections,public.workflow_events to authenticated;
create policy selection_reader on public.offer_selections for select to authenticated using(exists(select 1 from public.rfqs r where r.id=rfq_id and private.is_member(r.organization_id)) or exists(select 1 from public.offers o where o.id=offer_id and private.is_member(o.supplier_organization_id)));
create policy workflow_event_reader on public.workflow_events for select to authenticated using(private.is_member(organization_id));
-- Notification rows are created in the business transaction; no network call in SQL.
create function private.notify_exchange() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.threads;r public.rfqs;recipient_org uuid;template_name text;
begin
 select * into t from public.threads where id=new.thread_id;select * into r from public.rfqs where id=t.rfq_id;
 if TG_TABLE_NAME='messages' then recipient_org=case when new.sender_organization_id=r.organization_id then t.supplier_organization_id else r.organization_id end;template_name='new_message';
 else recipient_org=r.organization_id;template_name='new_offer';end if;
 insert into public.notification_outbox(event_key,recipient_id,template,resource_id)
 select template_name||':'||new.id||':'||m.user_id,m.user_id,template_name,t.id from public.memberships m where m.organization_id=recipient_org and m.active and m.role in ('owner','admin',case when recipient_org=r.organization_id then 'procurement' else 'sales' end);
 return new;
end $$;
revoke all on function private.notify_exchange() from public,anon,authenticated;
create trigger notify_message after insert on public.messages for each row execute function private.notify_exchange();
create trigger notify_offer after insert on public.offers for each row execute function private.notify_exchange();
create table public.review_assignments (
 owner_id uuid primary key references public.supplier_applications(owner_id),reviewer_id uuid not null references auth.users(id),
 submission_revision integer not null,identity_checked boolean not null default false,scope_checked boolean not null default false,
 privacy_checked boolean not null default false,internal_note text not null default '',updated_at timestamptz not null default now()
);
alter table public.review_assignments enable row level security;
revoke all on public.review_assignments from anon,authenticated;
grant select on public.review_assignments to authenticated;
create policy assigned_review on public.review_assignments for select to authenticated using((select private.is_reviewer()));
create policy reviewer_file_read on public.supplier_application_files for select to authenticated using(exists(select 1 from public.review_assignments a where a.owner_id=supplier_application_files.owner_id and a.reviewer_id=auth.uid()) and private.is_reviewer());
create policy reviewer_storage_read on storage.objects for select to authenticated using(bucket_id='gsl-onboarding' and exists(select 1 from public.supplier_application_files f join public.review_assignments a using(owner_id) where f.object_path=storage.objects.name and a.reviewer_id=auth.uid()) and private.is_reviewer());
alter function private.workflow(text,jsonb,uuid) rename to workflow_base;
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
   for item in select value from jsonb_array_elements(app.payload->'products') loop
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
revoke all on function private.workflow_base(text,jsonb,uuid) from authenticated;
create function private.workflow(action text,args jsonb,command uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid();r public.rfqs;o public.offers;result jsonb;target uuid;
begin
 if actor is null then raise exception 'LOGIN_REQUIRED';end if;
 if command is null or args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>180000 then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||command::text,0));
 select c.result into result from public.workflow_commands c where c.actor_id=actor and c.command_id=command and c.action=workflow_impl.action;
 if result is not null then return result;end if;
 if action='enable_buyer' then
  target=(args->>'organization')::uuid;
  if not private.is_member(target,array['owner','admin']) then raise exception 'FORBIDDEN';end if;
  update public.organizations set buyer=true where id=target and not buyer;
  insert into public.workflow_events(organization_id,actor_id,action,resource_id) values(target,actor,action,target);
  result=jsonb_build_object('saved',true);
  insert into public.workflow_commands(actor_id,command_id,action,result) values(actor,command,action,result);return result;
 end if;
 if action in ('claim_review','review_checks') then
  if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
  perform 1 from public.supplier_applications a where a.owner_id=(args->>'owner')::uuid and a.revision=(args->>'revision')::int and a.status in ('submitted','in_review') for update;
  if not found then raise exception 'CONFLICT';end if;
  if action='claim_review' then
   insert into public.review_assignments(owner_id,reviewer_id,submission_revision) values((args->>'owner')::uuid,actor,(args->>'revision')::int)
    on conflict(owner_id) do update set submission_revision=excluded.submission_revision,identity_checked=false,scope_checked=false,privacy_checked=false,updated_at=now() where review_assignments.reviewer_id=actor;
   if not found then raise exception 'ASSIGNED_TO_ANOTHER_REVIEWER';end if;
  else
   if length(trim(coalesce(args->>'note','')))<10 then raise exception 'FEEDBACK_REQUIRED';end if;
   update public.review_assignments set identity_checked=(args->>'identity')='true',scope_checked=(args->>'scope')='true',privacy_checked=(args->>'privacy')='true',internal_note=left(args->>'note',10000),updated_at=now()
    where owner_id=(args->>'owner')::uuid and reviewer_id=actor and submission_revision=(args->>'revision')::int;
   if not found then raise exception 'FORBIDDEN';end if;
  end if;
  result=jsonb_build_object('saved',true);
  insert into public.workflow_commands(actor_id,command_id,action,result) values(actor,command,action,result);return result;
 end if;
 if action not in ('select_offer','cancel_rfq','share_assistance','add_recipient') then return private.workflow_base(action,args,command);end if;
 select * into r from public.rfqs where id=(args->>'id')::uuid for update;
 if r.id is null or not private.is_member(r.organization_id,array['owner','admin','procurement']) then raise exception 'FORBIDDEN';end if;
 if r.revision is distinct from (args->>'revision')::int then raise exception 'CONFLICT';end if;
 if action='select_offer' then
  select f.* into o from public.offers f join public.threads t on t.id=f.thread_id where f.id=(args->>'offer')::uuid and t.rfq_id=r.id for update of f;
  if r.state<>'sent' or o.id is null or o.valid_until<current_date or exists(select 1 from public.offers x where x.thread_id=o.thread_id and x.version>o.version) then raise exception 'INVALID_OFFER';end if;
  insert into public.offer_selections(rfq_id,offer_id,selected_by) values(r.id,o.id,actor);
  update public.rfqs set state='closed',revision=revision+1 where id=r.id;
  insert into public.notification_outbox(event_key,recipient_id,template,resource_id)
   select command::text||':'||m.user_id,m.user_id,'offer_selected',o.thread_id from public.memberships m join public.threads t on t.supplier_organization_id=m.organization_id
   where t.id=o.thread_id and m.active and m.role in ('owner','admin','sales');
 elsif action='cancel_rfq' then
  if r.state not in ('draft','sent') then raise exception 'CONFLICT';end if;
  update public.rfqs set state='cancelled',revision=revision+1 where id=r.id;
  insert into public.notification_outbox(event_key,recipient_id,template,resource_id)
   select distinct command::text||':'||m.user_id,m.user_id,'rfq_cancelled',r.id from public.memberships m join public.rfq_recipients rc on rc.supplier_organization_id=m.organization_id
   where rc.rfq_id=r.id and m.active and m.role in ('owner','admin','sales');
 elsif action='share_assistance' then
  if (args->>'consent') is distinct from 'true' then raise exception 'CONSENT_REQUIRED';end if;
  update public.rfqs set mode='assisted',assistance_shared_at=now() where id=r.id;
 elsif action='add_recipient' then
  target=(args->>'supplier')::uuid;
  if r.state<>'sent' or target=r.organization_id or (select count(*) from public.rfq_recipients where rfq_id=r.id)>=5 then raise exception 'CONFLICT';end if;
  perform 1 from public.published_supplier_profiles where organization_id=target and withdrawn_at is null for share;
  if not found then raise exception 'NOT_PUBLISHED';end if;
  insert into public.rfq_recipients(rfq_id,supplier_organization_id) values(r.id,target);
  insert into public.threads(rfq_id,supplier_organization_id) values(r.id,target) returning id into target;
  insert into public.notification_outbox(event_key,recipient_id,template,resource_id)
   select command::text||':'||m.user_id,m.user_id,'new_rfq',target from public.memberships m where m.organization_id=(args->>'supplier')::uuid and m.active and m.role in ('owner','admin','sales');
  update public.rfqs set revision=revision+1 where id=r.id;
 end if;
 insert into public.workflow_events(organization_id,actor_id,action,resource_id) values(r.organization_id,actor,action,r.id);
 result=jsonb_build_object('id',r.id,'saved',true);
 insert into public.workflow_commands(actor_id,command_id,action,result) values(actor,command,action,result);
 return result;
end $$;
create or replace function public.workflow(action text,args jsonb,command uuid) returns jsonb language sql security invoker set search_path='' as $$select private.workflow(action,args,command)$$;
revoke all on function private.workflow(text,jsonb,uuid) from public,anon;
grant execute on function private.workflow(text,jsonb,uuid) to authenticated;

create or replace function private.review_queue() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
 return (select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (
  select s.owner_id,s.payload,s.status,s.revision,s.updated_at,
   (select to_jsonb(r) from public.review_assignments r where r.owner_id=s.owner_id) assignment,
   (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'kind',f.kind,'size',f.size)),'[]') from public.supplier_application_files f where f.owner_id=s.owner_id and exists(select 1 from public.review_assignments r where r.owner_id=s.owner_id and r.reviewer_id=auth.uid())) files
  from public.supplier_applications s where status in ('submitted','in_review') order by updated_at limit 100
 ) a);
end $$;

alter table public.notification_outbox add column lease_id uuid;
alter table public.notification_outbox add column lease_until timestamptz;
alter table public.notification_outbox add column provider_reference text;
alter table public.notification_outbox add column failure_code text;
alter table public.notification_outbox add column template_version text not null default '2026-09-29';
create index notification_pending on public.notification_outbox(available_at) where state='pending';
-- Only server worker role may claim/acknowledge. Expired SMTP leases are NOT retried blindly.
create function private.claim_notifications(lease_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if lease_id is null then raise exception 'INVALID';end if;
 update public.notification_outbox set state='failed',failure_code='WORKER_INTERRUPTED_DELIVERY_UNCERTAIN' where state='processing' and lease_until<now();
 with batch as (select id from public.notification_outbox where state='pending' and available_at<=now() and attempts<5 order by available_at for update skip locked limit 2), claimed as (
 update public.notification_outbox n set state='processing',lease_id=claim_notifications.lease_id,lease_until=now()+interval '2 minutes',attempts=attempts+1 from batch b where n.id=b.id returning n.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'template',c.template,'language',c.language,'resource_id',c.resource_id,'email',u.email)),'[]') into result from claimed c join auth.users u on u.id=c.recipient_id;
 return result;
end $$;
create function private.finish_notification(job_id uuid,lease_id uuid,outcome text,provider_reference text,failure_code text) returns void language plpgsql security definer set search_path='' as $$
begin
 if outcome not in ('accepted','retry','failed') then raise exception 'INVALID';end if;
 update public.notification_outbox n set state=case when outcome='retry' and n.attempts<5 then 'pending' when outcome='retry' then 'failed' else outcome end,
 available_at=now()+make_interval(secs=>least(3600,30*power(2,n.attempts)::int)),provider_reference=left(finish_notification.provider_reference,250),failure_code=left(finish_notification.failure_code,100),lease_until=null
 where n.id=job_id and n.lease_id=finish_notification.lease_id and n.state='processing';
 if not found then raise exception 'LEASE_CONFLICT';end if;
end $$;
create function public.claim_notifications(lease_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.claim_notifications(lease_id)$$;
create function public.finish_notification(job_id uuid,lease_id uuid,outcome text,provider_reference text,failure_code text) returns void language sql security invoker set search_path='' as $$select private.finish_notification(job_id,lease_id,outcome,provider_reference,failure_code)$$;
revoke all on function private.claim_notifications(uuid),private.finish_notification(uuid,uuid,text,text,text),public.claim_notifications(uuid),public.finish_notification(uuid,uuid,text,text,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.claim_notifications(uuid),private.finish_notification(uuid,uuid,text,text,text),public.claim_notifications(uuid),public.finish_notification(uuid,uuid,text,text,text) to service_role;
create function private.notify_submission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='submitted' then insert into public.notification_outbox(event_key,recipient_id,template,resource_id) values('submission:'||new.owner_id||':'||new.revision,new.owner_id,'submission_received',new.owner_id) on conflict(event_key) do nothing;end if;
 return new;
end $$;
revoke all on function private.notify_submission() from public,anon,authenticated;
create trigger notify_submission after insert or update on public.supplier_applications for each row execute function private.notify_submission();
-- File reservations serialize quotas and submission without holding a network transaction.
create table public.onboarding_uploads (
 id uuid primary key,owner_id uuid not null references public.supplier_applications(owner_id),object_path text not null unique,
 kind text not null check(kind in ('logo','factory','product','registration','certificate','technical')),name text not null,size integer not null check(size between 1 and 3145728),
 caption text not null default '',state text not null check(state in ('reserved','ready','deleting','removed','failed')),
 scan_state text not null default 'quarantined' check(scan_state in ('quarantined','clean','rejected')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.onboarding_uploads enable row level security;
revoke all on public.onboarding_uploads from anon,authenticated;
grant select on public.onboarding_uploads to authenticated;
create policy own_upload on public.onboarding_uploads for select to authenticated using(owner_id=auth.uid());
insert into public.onboarding_uploads(id,owner_id,object_path,kind,name,size,caption,state)
 select id,owner_id,object_path,kind,name,size,caption,'ready' from public.supplier_application_files;
revoke insert,delete on public.supplier_application_files from authenticated;
-- Revoke column-level INSERT privileges as well as the table privilege.
revoke insert(id,owner_id,object_path,kind,name,size,caption) on public.supplier_application_files from authenticated;
drop policy onboarding_storage_insert on storage.objects;
drop policy onboarding_storage_delete on storage.objects;
create policy onboarding_storage_insert on storage.objects for insert to authenticated with check(bucket_id='gsl-onboarding' and exists(select 1 from public.onboarding_uploads u where u.owner_id=auth.uid() and u.object_path=storage.objects.name and u.state='reserved' and u.created_at>now()-interval '15 minutes'));
create policy onboarding_storage_delete on storage.objects for delete to authenticated using(bucket_id='gsl-onboarding' and exists(select 1 from public.onboarding_uploads u where u.owner_id=auth.uid() and u.object_path=storage.objects.name and u.state in ('reserved','deleting','failed')));
create function private.manage_upload(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.supplier_applications;u public.onboarding_uploads;file_id uuid;path text;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into a from public.supplier_applications where owner_id=auth.uid() for update;
 if a.owner_id is null or a.status not in ('draft','changes_requested') then raise exception 'LOCKED';end if;
 if action='reserve' then
  if (select count(*) from public.onboarding_uploads where owner_id=auth.uid() and state not in ('removed','failed'))>=40 then raise exception 'FILE_LIMIT';end if;
  if args->>'extension' not in ('pdf','png','jpg','webp') or length(coalesce(args->>'name','')) not between 1 and 180 or length(coalesce(args->>'caption',''))>250 then raise exception 'INVALID';end if;
  file_id=gen_random_uuid();path=auth.uid()::text||'/'||file_id::text||'.'||(args->>'extension');
  insert into public.onboarding_uploads(id,owner_id,object_path,kind,name,size,caption,state) values(file_id,auth.uid(),path,args->>'kind',args->>'name',(args->>'size')::integer,coalesce(args->>'caption',''),'reserved') returning * into u;
  if (args->>'rightsAttested')='true' and u.kind in ('logo','factory','product') then update public.onboarding_uploads set rights_attested_at=now() where id=u.id;end if;
 else
  select * into u from public.onboarding_uploads where id=(args->>'id')::uuid and owner_id=auth.uid() for update;
  if u.id is null then raise exception 'NOT_FOUND';end if;
  if action='finalize' then
   if u.state='ready' then return jsonb_build_object('id',u.id,'path',u.object_path,'state',u.state);end if;
   if u.state<>'reserved' or not exists(select 1 from storage.objects o where o.bucket_id='gsl-onboarding' and o.name=u.object_path and (o.metadata->>'size')::bigint=u.size) then raise exception 'UPLOAD_NOT_CONFIRMED';end if;
   insert into public.supplier_application_files(id,owner_id,object_path,kind,name,size,caption) values(u.id,u.owner_id,u.object_path,u.kind,u.name,u.size,u.caption);
   update public.onboarding_uploads set state='ready',updated_at=now() where id=u.id returning * into u;
  elsif action='delete' then
   if u.state not in ('ready','reserved','deleting','failed') then raise exception 'LOCKED';end if;
   update public.onboarding_uploads set state='deleting',updated_at=now() where id=u.id returning * into u;
  elsif action='removed' then
   if u.state not in ('deleting','reserved','failed') or exists(select 1 from storage.objects o where o.bucket_id='gsl-onboarding' and o.name=u.object_path) then raise exception 'DELETE_NOT_CONFIRMED';end if;
   delete from public.supplier_application_files where id=u.id;
   update public.onboarding_uploads set state='removed',updated_at=now() where id=u.id returning * into u;
  else raise exception 'INVALID';end if;
 end if;
 return jsonb_build_object('id',u.id,'path',u.object_path,'state',u.state);
end $$;
create function public.manage_upload(action text,args jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.manage_upload(action,args)$$;
revoke all on function private.manage_upload(text,jsonb),public.manage_upload(text,jsonb) from public,anon;
grant execute on function private.manage_upload(text,jsonb),public.manage_upload(text,jsonb) to authenticated;
create function private.check_uploads_before_submission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='submitted' and exists(select 1 from public.onboarding_uploads u where u.owner_id=new.owner_id and u.state in ('reserved','deleting')) then raise exception 'FILES_PENDING';end if;
 return new;
end $$;
revoke all on function private.check_uploads_before_submission() from public,anon,authenticated;
create trigger check_uploads_before_submission before insert or update on public.supplier_applications for each row execute function private.check_uploads_before_submission();

-- Contact intake is bounded in PostgreSQL, not in one server instance.
create table public.contact_requests (
 id uuid primary key,email text not null,name text not null,subject text not null,body text not null,
 language text not null check(language in ('fr','en')),created_at timestamptz not null default now(),resolved_at timestamptz
);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from anon,authenticated;
grant select on public.contact_requests to authenticated;
create policy reviewer_contact on public.contact_requests for select to authenticated using((select private.is_reviewer()));
alter table public.notification_outbox alter column recipient_id drop not null;
alter table public.notification_outbox add column recipient_email text;
alter table public.notification_outbox add constraint notification_recipient check(recipient_id is not null or recipient_email is not null);
create function private.submit_contact(request_id uuid,email text,name text,subject text,body text,language text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if request_id is null or length(email)>254 or email!~'^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' or length(trim(name)) not between 2 and 150 or length(trim(subject)) not between 3 and 150 or length(trim(body)) not between 20 and 5000 or language not in ('fr','en') then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('gsl-contact-global',0));
 if exists(select 1 from public.contact_requests c where c.id=request_id) then
  if exists(select 1 from public.contact_requests c where c.id=request_id and c.email=lower(submit_contact.email) and c.body=submit_contact.body) then return request_id;end if;raise exception 'CONFLICT';end if;
 if (select count(*) from public.contact_requests where created_at>now()-interval '1 minute')>=30 or (select count(*) from public.contact_requests c where c.email=lower(submit_contact.email) and created_at>now()-interval '1 hour')>=3 then raise exception 'RATE_LIMITED';end if;
 insert into public.contact_requests(id,email,name,subject,body,language) values(request_id,lower(email),name,subject,body,language);
 insert into public.notification_outbox(event_key,recipient_email,template,resource_id,language) values('contact:'||request_id,lower(email),'contact_received',request_id,language),('contact-operator:'||request_id,'contact@gsl-systems.com','contact_operator',request_id,'fr');
 return request_id;
end $$;
create function public.submit_contact(request_id uuid,email text,name text,subject text,body text,language text) returns uuid language sql security invoker set search_path='' as $$select private.submit_contact(request_id,email,name,subject,body,language)$$;
revoke all on function private.submit_contact(uuid,text,text,text,text,text),public.submit_contact(uuid,text,text,text,text,text) from public;
grant usage on schema private to anon;
grant execute on function private.submit_contact(uuid,text,text,text,text,text),public.submit_contact(uuid,text,text,text,text,text) to anon,authenticated;
create or replace function private.claim_notifications(lease_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if lease_id is null then raise exception 'INVALID';end if;
 update public.notification_outbox set state='failed',failure_code='WORKER_INTERRUPTED_DELIVERY_UNCERTAIN' where state='processing' and lease_until<now();
 with batch as (select id from public.notification_outbox where state='pending' and available_at<=now() and attempts<5 order by available_at for update skip locked limit 2), claimed as (
 update public.notification_outbox n set state='processing',lease_id=claim_notifications.lease_id,lease_until=now()+interval '2 minutes',attempts=attempts+1 from batch b where n.id=b.id returning n.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'template',c.template,'language',c.language,'resource_id',c.resource_id,'email',coalesce(u.email,c.recipient_email))),'[]') into result from claimed c left join auth.users u on u.id=c.recipient_id;
 return result;
end $$;

create function private.current_email() returns text language sql stable security definer set search_path='' as $$select lower(email) from auth.users where id=auth.uid()$$;
revoke all on function private.current_email() from public,anon;
grant execute on function private.current_email() to authenticated;
create table public.organization_invitations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),email text not null,
 role text not null check(role in ('admin','procurement','sales','viewer')),invited_by uuid not null references auth.users(id),
 state text not null default 'pending' check(state in ('pending','accepted','revoked')),expires_at timestamptz not null default now()+interval '7 days',
 created_at timestamptz not null default now(),accepted_at timestamptz
);
alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from anon,authenticated;
grant select on public.organization_invitations to authenticated;
create policy invitation_read on public.organization_invitations for select to authenticated using(private.is_member(organization_id,array['owner','admin']) or email=private.current_email());
create unique index pending_invite on public.organization_invitations(organization_id,email) where state='pending';
create function private.manage_members(action text,args jsonb,command uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid();org uuid;inv public.organization_invitations;result jsonb;target uuid;member_role text;
begin
 if actor is null or command is null then raise exception 'LOGIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||command::text,0));
 select c.result into result from public.workflow_commands c where c.actor_id=actor and c.command_id=command and c.action=manage_members.action;
 if result is not null then return result;end if;
 if action='accept_invitation' then
  select * into inv from public.organization_invitations where id=(args->>'id')::uuid for update;
  if inv.id is null or inv.email is distinct from private.current_email() or inv.state<>'pending' or inv.expires_at<now() then raise exception 'FORBIDDEN';end if;
  if exists(select 1 from public.memberships where organization_id=inv.organization_id and user_id=actor and active) then raise exception 'ALREADY_MEMBER';end if;
  insert into public.memberships(organization_id,user_id,role) values(inv.organization_id,actor,inv.role) on conflict(organization_id,user_id) do update set role=excluded.role,active=true;
  update public.organization_invitations set state='accepted',accepted_at=now() where id=inv.id;org=inv.organization_id;target=inv.id;
 else
  org=(args->>'organization')::uuid;
  perform 1 from public.organizations where id=org for update;
  if not private.is_member(org,array['owner','admin']) then raise exception 'FORBIDDEN';end if;
  if action='invite_member' then
   if coalesce(args->>'email','')!~'^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' or length(args->>'email')>254 then raise exception 'INVALID';end if;
   if (select count(*) from public.organization_invitations where organization_id=org and created_at>now()-interval '1 hour')>=20 then raise exception 'RATE_LIMITED';end if;
   if args->>'role'='admin' and not private.is_member(org,array['owner']) then raise exception 'FORBIDDEN';end if;
   update public.organization_invitations set state='revoked' where organization_id=org and email=lower(args->>'email') and state='pending' and expires_at<now();
   insert into public.organization_invitations(organization_id,email,role,invited_by) values(org,lower(args->>'email'),args->>'role',actor) returning * into inv;target=inv.id;
   insert into public.notification_outbox(event_key,recipient_email,template,resource_id) values('invitation:'||inv.id,inv.email,'invitation_received',inv.id);
  elsif action='remove_member' then
   target=(args->>'user')::uuid;
   select role into member_role from public.memberships where organization_id=org and user_id=target and active;
   if member_role is null or member_role='owner' or target=actor or (member_role='admin' and not private.is_member(org,array['owner'])) then raise exception 'FORBIDDEN';end if;
   update public.memberships set active=false where organization_id=org and user_id=target;
  elsif action='revoke_invitation' then
   target=(args->>'id')::uuid;
   update public.organization_invitations set state='revoked' where id=target and organization_id=org and state='pending';if not found then raise exception 'CONFLICT';end if;
  else raise exception 'INVALID';end if;
 end if;
 insert into public.workflow_events(organization_id,actor_id,action,resource_id) values(org,actor,action,target);
 result=jsonb_build_object('saved',true,'id',target);insert into public.workflow_commands(actor_id,command_id,action,result) values(actor,command,action,result);return result;
end $$;
create function public.manage_members(action text,args jsonb,command uuid) returns jsonb language sql security invoker set search_path='' as $$select private.manage_members(action,args,command)$$;
revoke all on function private.manage_members(text,jsonb,uuid),public.manage_members(text,jsonb,uuid) from public,anon;
grant execute on function private.manage_members(text,jsonb,uuid),public.manage_members(text,jsonb,uuid) to authenticated;
create function private.notification_language() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.recipient_id is not null then select case when coalesce(p.language,u.raw_user_meta_data->>'language')='fr' then 'fr' else 'en' end into new.language from auth.users u left join public.profiles p on p.user_id=u.id where u.id=new.recipient_id;end if;return new;
end $$;
revoke all on function private.notification_language() from public,anon,authenticated;
create trigger notification_language before insert on public.notification_outbox for each row execute function private.notification_language();

revoke all on function private.workflow_base(text,jsonb,uuid) from public,anon,authenticated;

-- Enabling the purchasing role does not change a supplier's reviewed assertions.
create or replace function private.withdraw_company() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authenticated change required';end if;
 if new.buyer is distinct from old.buyer and (to_jsonb(new)-array['buyer','revision','updated_at'])=(to_jsonb(old)-array['buyer','revision','updated_at']) then return new;end if;
 update public.published_supplier_profiles set withdrawn_at=now() where organization_id=new.id;
 update public.published_products set withdrawn_at=now() where organization_id=new.id;
 return new;
end $$;

-- A drawing can be shared with one recipient without exposing it to competitors.
alter table public.rfq_files add column recipient_organization_id uuid references public.organizations(id);
alter table public.files add column upload_state text not null default 'ready' check(upload_state in ('reserved','ready','deleting','removed'));
revoke insert(id,organization_id,object_path,original_name,mime_type,size_bytes,purpose,media_origin,caption,rights_attested_at) on public.files from authenticated;
revoke insert on public.rfq_files from authenticated;
create or replace function private.can_read_file(file uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.files f where f.id=file and f.upload_state='ready' and
 (private.is_member(f.organization_id,array['owner','admin','procurement','sales']) or
 (f.scan_status='clean' and exists(select 1 from public.rfq_files a join public.rfqs r on r.id=a.rfq_id join public.rfq_recipients x on x.rfq_id=r.id
 where a.file_id=f.id and r.state<>'draft' and (a.recipient_organization_id is null or a.recipient_organization_id=x.supplier_organization_id)
 and private.is_member(x.supplier_organization_id,array['owner','admin','sales'])))));
$$;
drop policy rfq_file_read on public.rfq_files;
create policy rfq_file_read on public.rfq_files for select to authenticated using(private.is_member(organization_id,array['owner','admin','procurement']) or private.can_read_file(file_id));
drop policy gsl_private_upload on storage.objects;
create policy gsl_private_upload on storage.objects for insert to authenticated with check(bucket_id='gsl-private' and exists(select 1 from public.files f where f.object_path=name and f.uploaded_by=auth.uid() and f.upload_state='reserved' and f.created_at>now()-interval '15 minutes' and private.is_member(f.organization_id,array['owner','admin','procurement'])));
create policy gsl_private_delete on storage.objects for delete to authenticated using(bucket_id='gsl-private' and exists(select 1 from public.files f where f.object_path=name and f.upload_state in ('reserved','deleting') and private.is_member(f.organization_id,array['owner','admin','procurement'])));
create function private.manage_rfq_file(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rfqs;f public.files;fid uuid;target uuid;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into r from public.rfqs where id=(args->>'rfq')::uuid for update;
 if r.id is null or r.state<>'draft' or not private.is_member(r.organization_id,array['owner','admin','procurement']) then raise exception 'FORBIDDEN';end if;
 if action='reserve' then
  if (select count(*) from public.rfq_files a join public.files quota_file on quota_file.id=a.file_id where a.rfq_id=r.id and quota_file.upload_state<>'removed')>=20 then raise exception 'FILE_LIMIT';end if;
  if args->>'mime' not in ('application/pdf','image/png','image/jpeg','image/webp') or length(coalesce(args->>'name','')) not between 1 and 180 or (args->>'size')::bigint not between 1 and 3145728 then raise exception 'INVALID';end if;
  target=nullif(args->>'recipient','')::uuid;
  if target is not null and not exists(select 1 from public.published_supplier_profiles where organization_id=target and withdrawn_at is null) then raise exception 'NOT_PUBLISHED';end if;
  fid=gen_random_uuid();
  insert into public.files(id,organization_id,object_path,original_name,mime_type,size_bytes,purpose,upload_state) values(fid,r.organization_id,r.organization_id||'/'||fid,args->>'name',args->>'mime',(args->>'size')::bigint,'drawing','reserved') returning * into f;
  insert into public.rfq_files(organization_id,rfq_id,file_id,recipient_organization_id) values(r.organization_id,r.id,f.id,target);
 else
  select x.* into f from public.files x join public.rfq_files a on a.file_id=x.id where a.rfq_id=r.id and x.id=(args->>'id')::uuid for update of x;
  if f.id is null then raise exception 'NOT_FOUND';end if;
  if action='finalize' then
   if f.upload_state<>'reserved' or not exists(select 1 from storage.objects o where o.bucket_id='gsl-private' and o.name=f.object_path and (o.metadata->>'size')::bigint=f.size_bytes) then raise exception 'FILE_METADATA';end if;
   update public.files set upload_state='ready' where id=f.id;
  elsif action='delete' then
   update public.files set upload_state='deleting' where id=f.id;
  elsif action='removed' then
   if exists(select 1 from storage.objects where bucket_id='gsl-private' and name=f.object_path) then raise exception 'OBJECT_STILL_PRESENT';end if;
   update public.files set upload_state='removed' where id=f.id;
  else raise exception 'INVALID';end if;
 end if;
 return jsonb_build_object('id',f.id,'path',f.object_path);
end $$;
create function public.manage_rfq_file(action text,args jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.manage_rfq_file(action,args)$$;
revoke all on function private.manage_rfq_file(text,jsonb),public.manage_rfq_file(text,jsonb) from public,anon;
grant execute on function private.manage_rfq_file(text,jsonb),public.manage_rfq_file(text,jsonb) to authenticated;
create function private.require_scanned_rfq_files() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='sent' and old.state='draft' and exists(select 1 from public.rfq_files a join public.files f on f.id=a.file_id where a.rfq_id=new.id and f.upload_state<>'removed' and (f.upload_state<>'ready' or f.scan_status<>'clean')) then raise exception 'FILES_PENDING';end if;
 return new;
end $$;
revoke all on function private.require_scanned_rfq_files() from public,anon,authenticated;
create trigger require_scanned_rfq_files before update on public.rfqs for each row execute function private.require_scanned_rfq_files();
-- Called only by the trusted scanner adapter after a real scan of the downloaded bytes.
create function private.record_file_scan(file_id uuid,verdict text) returns void language plpgsql security definer set search_path='' as $$
begin
 if verdict not in ('clean','rejected') then raise exception 'INVALID';end if;
 update public.files set scan_status=verdict where id=file_id and upload_state='ready' and scan_status='pending';
 if not found then raise exception 'FILE_STATE';end if;
end $$;
create function public.record_file_scan(file_id uuid,verdict text) returns void language sql security invoker set search_path='' as $$select private.record_file_scan(file_id,verdict)$$;
revoke all on function private.record_file_scan(uuid,text),public.record_file_scan(uuid,text) from public,anon,authenticated;
grant execute on function private.record_file_scan(uuid,text),public.record_file_scan(uuid,text) to service_role;
drop policy files_read on public.files;
create policy files_read on public.files for select to authenticated using(private.can_read_file(id) or private.is_member(organization_id,array['owner','admin','procurement','sales']));

-- The same command key may only be retried with the same intent.
create table private.command_inputs(actor_id uuid not null,command_id uuid not null,action text not null,args jsonb not null,primary key(actor_id,command_id));
alter table private.command_inputs enable row level security;
revoke all on private.command_inputs from public,anon,authenticated;
alter function private.workflow(text,jsonb,uuid) rename to workflow_impl;
revoke all on function private.workflow_impl(text,jsonb,uuid) from public,anon,authenticated;
create function private.workflow(action text,args jsonb,command uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if command is null or action is null or args is null then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||command::text,0));
 insert into private.command_inputs(actor_id,command_id,action,args) values(auth.uid(),command,action,args) on conflict do nothing;
 if not exists(select 1 from private.command_inputs i where i.actor_id=auth.uid() and i.command_id=command and i.action=workflow.action and i.args=workflow.args) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 return private.workflow_impl(action,args,command);
end $$;
revoke all on function private.workflow(text,jsonb,uuid) from public,anon;
grant execute on function private.workflow(text,jsonb,uuid) to authenticated;

-- Reopening a published profile withdraws its assertions before editing. It never
-- deletes historical applications, quotations or product identities.
create function private.reopen_supplier(expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.supplier_applications;
begin
 select * into a from public.supplier_applications where owner_id=auth.uid() for update;
 if a.owner_id is null or a.revision is distinct from expected_revision or a.status not in ('reviewed','submitted','changes_requested') then raise exception 'CONFLICT';end if;
 if a.organization_id is not null then
  if not private.is_member(a.organization_id,array['owner','admin']) then raise exception 'FORBIDDEN';end if;
  update public.published_supplier_profiles set withdrawn_at=now() where organization_id=a.organization_id;
  update public.published_products set withdrawn_at=now() where organization_id=a.organization_id;
  update public.published_media set withdrawn_at=now() where organization_id=a.organization_id;
 end if;
 update public.supplier_applications set status='draft' where owner_id=a.owner_id returning * into a;
 return jsonb_build_object('revision',a.revision,'status',a.status,'updated_at',a.updated_at);
end $$;
create function public.reopen_supplier(expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.reopen_supplier(expected_revision)$$;
revoke all on function private.reopen_supplier(integer),public.reopen_supplier(integer) from public,anon;
grant execute on function private.reopen_supplier(integer),public.reopen_supplier(integer) to authenticated;

alter table public.production_sites add column retired_at timestamptz;
alter table public.capabilities add column retired_at timestamptz;
create table private.reviewed_entity_identifiers(
 country text not null,authority text not null,identifier text not null,organization_id uuid not null references public.organizations(id),
 primary key(country,authority,identifier)
);
alter table private.reviewed_entity_identifiers enable row level security;
revoke all on private.reviewed_entity_identifiers from public,anon,authenticated;
create function private.claim_company_identity(payload jsonb,org uuid) returns void language plpgsql security definer set search_path='' as $$
declare identity_country text=payload->>'country';identity_authority text;identity_value text;
begin
 if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
 case identity_country
 when 'FR' then identity_authority='SIREN';identity_value=payload#>>'{identifiers,siren}';
 when 'TR' then identity_authority='MERSIS';identity_value=payload#>>'{identifiers,mersis}';
 when 'GE' then identity_authority='NAPR';identity_value=payload#>>'{identifiers,identification_code}';
 when 'MA' then identity_authority='RC:'||coalesce(payload#>>'{identifiers,registry_court}','');identity_value=payload#>>'{identifiers,trade_registry_number}';
 when 'TN' then identity_authority='RNE';identity_value=payload#>>'{identifiers,registry_identifier}';
 when 'GB' then identity_authority='COMPANIES_HOUSE';identity_value=payload#>>'{identifiers,company_number}';
 else identity_authority=coalesce(payload#>>'{identifiers,registry_authority}',payload#>>'{identifiers,registry_name}',payload#>>'{identifiers,registry_court}','')||':'||coalesce(payload#>>'{identifiers,formation_jurisdiction}',payload#>>'{identifiers,register_type}','');identity_value=payload#>>'{identifiers,registry_identifier}';
 end case;
 if nullif(trim(identity_value),'') is null or nullif(trim(identity_authority),':') is null then return;end if;
 insert into private.reviewed_entity_identifiers(country,authority,identifier,organization_id) values(identity_country,upper(trim(identity_authority)),upper(trim(identity_value)),org)
 on conflict(country,authority,identifier) do update set organization_id=excluded.organization_id where reviewed_entity_identifiers.organization_id=excluded.organization_id;
 if not found then raise exception 'COMPANY_ALREADY_PRESENT';end if;
end $$;
revoke all on function private.claim_company_identity(jsonb,uuid) from public,anon,authenticated;

create table public.operator_actions(id uuid primary key default gen_random_uuid(),actor_id uuid not null,action text not null,resource_id uuid not null,created_at timestamptz not null default now());
alter table public.operator_actions enable row level security;
revoke all on public.operator_actions from anon,authenticated;
grant select on public.operator_actions to authenticated;
create policy operator_action_read on public.operator_actions for select to authenticated using(private.is_reviewer());
create function private.operations_overview() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object(
 'contacts',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (select id,name,email,subject,body,language,created_at,resolved_at from public.contact_requests where resolved_at is null order by created_at limit 100)c),
 'emailFailures',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from (select id,template,language,state,attempts,created_at,failure_code from public.notification_outbox where state='failed' order by created_at limit 100)n),
 'privacyRequests',(select coalesce(jsonb_agg(to_jsonb(pr)),'[]') from (select id,user_id,kind,created_at from public.privacy_requests where resolved_at is null order by created_at limit 100)pr),
 'activity',jsonb_build_object(
  'requestsTransmitted',(select count(distinct rfq_id) from public.rfq_recipients),
  'recipientDeliveries',(select count(*) from public.rfq_recipients),
  'conversationsAnswered',(select count(*) from public.threads t where exists(select 1 from public.messages m where m.thread_id=t.id and m.sender_organization_id=t.supplier_organization_id)),
  'conversationsQuoted',(select count(distinct thread_id) from public.offers),
  'offersSelected',(select count(*) from public.offer_selections),
  'medianFirstReplySeconds',(select percentile_cont(0.5) within group(order by response.seconds) from (
   select extract(epoch from (min(m.created_at)-rc.sent_at)) as seconds from public.threads t join public.rfq_recipients rc on rc.rfq_id=t.rfq_id and rc.supplier_organization_id=t.supplier_organization_id join public.messages m on m.thread_id=t.id and m.sender_organization_id=t.supplier_organization_id group by t.id,rc.sent_at)response)
 ),
 'pendingEmails',(select count(*) from public.notification_outbox where state in ('pending','processing')),
 'oldestPendingEmail',(select min(created_at) from public.notification_outbox where state in ('pending','processing')),
 'pendingApplications',(select count(*) from public.supplier_applications where status in ('submitted','in_review')));
end $$;
create function public.operations_overview() returns jsonb language sql security invoker set search_path='' as $$select private.operations_overview()$$;
create function private.resolve_contact(contact_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
 update public.contact_requests set resolved_at=now() where id=contact_id and resolved_at is null;
 if found then insert into public.operator_actions(actor_id,action,resource_id) values(auth.uid(),'contact_resolved',contact_id);end if;
end $$;
create function public.resolve_contact(contact_id uuid) returns void language sql security invoker set search_path='' as $$select private.resolve_contact(contact_id)$$;
revoke all on function private.operations_overview(),public.operations_overview(),private.resolve_contact(uuid),public.resolve_contact(uuid) from public,anon;
grant execute on function private.operations_overview(),public.operations_overview(),private.resolve_contact(uuid),public.resolve_contact(uuid) to authenticated;

-- Reviewer privilege needs both an explicit private grant and an AAL2 JWT.
create or replace function private.is_reviewer() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','aal1')='aal2' and exists(select 1 from private.platform_reviewers r where r.user_id=auth.uid());
$$;

create table public.privacy_requests(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),kind text not null check(kind='erasure'),
 created_at timestamptz not null default now(),resolved_at timestamptz,resolution text,reviewer_id uuid references auth.users(id)
);
create unique index one_pending_privacy_request on public.privacy_requests(user_id,kind) where resolved_at is null;
alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from anon,authenticated;
grant select on public.privacy_requests to authenticated;
create policy privacy_request_read on public.privacy_requests for select to authenticated using(user_id=auth.uid() or private.is_reviewer());
create function private.request_erasure() returns uuid language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':erasure',0));
 select id into request_id from public.privacy_requests where user_id=auth.uid() and resolved_at is null;
 if request_id is not null then return request_id;end if;
 insert into public.privacy_requests(user_id,kind) values(auth.uid(),'erasure') returning id into request_id;
 insert into public.notification_outbox(event_key,recipient_id,template,resource_id) values('erasure:'||request_id,auth.uid(),'privacy_request_received',request_id);
 insert into public.notification_outbox(event_key,recipient_email,template,resource_id) values('erasure-operator:'||request_id,'contact@gsl-systems.com','contact_operator',request_id);
 return request_id;
end $$;
create function public.request_erasure() returns uuid language sql security invoker set search_path='' as $$select private.request_erasure()$$;
revoke all on function private.request_erasure(),public.request_erasure() from public,anon;
grant execute on function private.request_erasure(),public.request_erasure() to authenticated;

-- Public pictures are derivatives, never the submitted private originals.
alter table public.onboarding_uploads add column rights_attested_at timestamptz;
create table private.media_jobs(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,source_file_id uuid references public.supplier_application_files(id) on delete set null,source_revision integer not null,
 organization_id uuid not null references public.organizations(id),reviewer_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),approved_at timestamptz
);
alter table private.media_jobs enable row level security;
revoke all on private.media_jobs from public,anon,authenticated;
create table public.published_media(
 id uuid primary key references private.media_jobs(id),organization_id uuid not null references public.organizations(id),
 kind text not null check(kind in ('logo','factory','product')),caption text not null,origin text not null default 'supplier_provided',
 published_at timestamptz not null default now(),withdrawn_at timestamptz
);
alter table public.published_media enable row level security;
revoke all on public.published_media from anon,authenticated;
grant select on public.published_media to anon,authenticated;
create policy approved_media_read on public.published_media for select to anon,authenticated using(withdrawn_at is null and exists(select 1 from public.published_supplier_profiles p where p.organization_id=published_media.organization_id and p.withdrawn_at is null));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gsl-derived-media','gsl-derived-media',false,3145728,array['image/webp']);
-- No ordinary role may upload or read this bucket directly. The public route checks
-- the live projection before the server downloads a generated WebP.
create function private.prepare_media(source_file uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.supplier_application_files;app public.supplier_applications;job uuid;
begin
 if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
 select * into f from public.supplier_application_files where id=source_file;
 select * into app from public.supplier_applications where owner_id=f.owner_id for update;
 if f.id is null or f.kind not in ('logo','factory','product') or app.status<>'reviewed' or app.organization_id is null then raise exception 'INVALID';end if;
 if not exists(select 1 from public.review_assignments where owner_id=f.owner_id and reviewer_id=auth.uid() and privacy_checked) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.onboarding_uploads where id=f.id and rights_attested_at is not null and state='ready') then raise exception 'MEDIA_RIGHTS_REQUIRED';end if;
 if not exists(select 1 from public.published_supplier_profiles where organization_id=app.organization_id and withdrawn_at is null) then raise exception 'NOT_PUBLISHED';end if;
 if (select count(*) from private.media_jobs where organization_id=app.organization_id and ((approved_at is not null and exists(select 1 from public.published_media m where m.id=media_jobs.id and m.withdrawn_at is null)) or (approved_at is null and created_at>now()-interval '1 hour')))>=20 then raise exception 'MEDIA_LIMIT';end if;
 insert into private.media_jobs(owner_id,source_file_id,source_revision,organization_id,reviewer_id) values(f.owner_id,f.id,app.revision,app.organization_id,auth.uid()) returning id into job;
 return jsonb_build_object('id',job,'sourcePath',f.object_path,'path',app.organization_id||'/'||job||'.webp');
end $$;
create function private.approve_media(job_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare j private.media_jobs;f public.supplier_application_files;
begin
 if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
 select * into j from private.media_jobs where id=job_id and reviewer_id=auth.uid() for update;
 if j.id is null then raise exception 'FORBIDDEN';end if;
 if j.approved_at is not null then return j.id;end if;
 if not exists(select 1 from public.supplier_applications where owner_id=j.owner_id and revision=j.source_revision and status='reviewed') then raise exception 'CONFLICT';end if;
 if not exists(select 1 from public.published_supplier_profiles where organization_id=j.organization_id and withdrawn_at is null) then raise exception 'NOT_PUBLISHED';end if;
 if not exists(select 1 from storage.objects where bucket_id='gsl-derived-media' and name=j.organization_id||'/'||j.id||'.webp' and (metadata->>'size')::bigint between 1 and 3145728) then raise exception 'IMAGE_NOT_READY';end if;
 select * into f from public.supplier_application_files where id=j.source_file_id;
 insert into public.published_media(id,organization_id,kind,caption) values(j.id,j.organization_id,f.kind,f.caption);
 update private.media_jobs set approved_at=now() where id=j.id;
 return j.id;
end $$;
create function public.prepare_media(source_file uuid) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_media(source_file)$$;
create function public.approve_media(job_id uuid) returns uuid language sql security invoker set search_path='' as $$select private.approve_media(job_id)$$;
revoke all on function private.prepare_media(uuid),public.prepare_media(uuid),private.approve_media(uuid),public.approve_media(uuid) from public,anon;
grant execute on function private.prepare_media(uuid),public.prepare_media(uuid),private.approve_media(uuid),public.approve_media(uuid) to authenticated;
create function private.media_candidates() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
 return (select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (
 select f.id,f.name,f.kind,f.caption,p.display_name,p.organization_id,u.rights_attested_at from public.supplier_application_files f
 join public.supplier_applications a on a.owner_id=f.owner_id join public.review_assignments r on r.owner_id=f.owner_id
 join public.onboarding_uploads u on u.id=f.id join public.published_supplier_profiles p on p.organization_id=a.organization_id
 where a.status='reviewed' and r.reviewer_id=auth.uid() and f.kind in ('logo','factory','product') and u.rights_attested_at is not null and p.withdrawn_at is null
 and not exists(select 1 from private.media_jobs j join public.published_media m on m.id=j.id where j.source_file_id=f.id and m.withdrawn_at is null)
 order by f.created_at limit 100)c);
end $$;
create function public.media_candidates() returns jsonb language sql security invoker set search_path='' as $$select private.media_candidates()$$;
revoke all on function private.media_candidates(),public.media_candidates() from public,anon;
grant execute on function private.media_candidates(),public.media_candidates() to authenticated;
