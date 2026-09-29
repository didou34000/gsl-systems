-- Additive operational foundation. Test in isolation before hosted deployment.
create table public.workspace_drafts (
 id uuid primary key, owner_id uuid not null default auth.uid() references auth.users(id),
 kind text not null check(kind in ('rfq','supplier')),title text not null default '' check(length(title)<=160),
 payload jsonb not null default '{}' check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16000),
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.saved_selections (
 owner_id uuid not null default auth.uid() references auth.users(id),
 product_id uuid not null references public.published_products(product_id),created_at timestamptz not null default now(),
 primary key(owner_id,product_id)
);
alter table public.workspace_drafts enable row level security;
alter table public.saved_selections enable row level security;
revoke all on public.workspace_drafts,public.saved_selections from anon,authenticated;
grant select on public.workspace_drafts,public.saved_selections to authenticated;
create policy own_drafts on public.workspace_drafts for select to authenticated using(owner_id=(select auth.uid()));
create policy own_selections on public.saved_selections for select to authenticated using(owner_id=(select auth.uid()));
create index workspace_drafts_owner on public.workspace_drafts(owner_id,updated_at desc);
create function private.save_workspace_draft(p_id uuid,p_revision integer,p_kind text,p_title text,p_payload jsonb)
returns public.workspace_drafts language plpgsql security definer set search_path='' as $$
declare d public.workspace_drafts;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if p_revision=0 then
  insert into public.workspace_drafts(id,owner_id,kind,title,payload) values(p_id,auth.uid(),p_kind,p_title,p_payload) returning * into d;
 else
  update public.workspace_drafts set title=p_title,payload=p_payload,revision=revision+1,updated_at=now()
   where id=p_id and owner_id=auth.uid() and revision=p_revision and kind=p_kind returning * into d;
  if d.id is null then raise exception 'CONFLICT';end if;
 end if;return d;
exception when unique_violation then raise exception 'CONFLICT';
end $$;
create function public.save_workspace_draft(p_id uuid,p_revision integer,p_kind text,p_title text,p_payload jsonb)
returns public.workspace_drafts language sql security invoker set search_path='' as $$select private.save_workspace_draft(p_id,p_revision,p_kind,p_title,p_payload)$$;
create function private.set_selection(p_product uuid,p_selected boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if not p_selected then delete from public.saved_selections where owner_id=auth.uid() and product_id=p_product;return;end if;
 if not exists(select 1 from public.published_products p join public.published_supplier_profiles s on s.organization_id=p.organization_id where p.product_id=p_product and p.withdrawn_at is null and s.withdrawn_at is null) then raise exception 'NOT_PUBLISHED';end if;
 insert into public.saved_selections(owner_id,product_id) values(auth.uid(),p_product) on conflict do nothing;
end $$;
create function public.set_selection(p_product uuid,p_selected boolean) returns void language sql security invoker set search_path='' as $$ select private.set_selection(p_product,p_selected) $$;
revoke all on function private.save_workspace_draft(uuid,integer,text,text,jsonb),public.save_workspace_draft(uuid,integer,text,text,jsonb),private.set_selection(uuid,boolean),public.set_selection(uuid,boolean) from public,anon;
grant execute on function private.save_workspace_draft(uuid,integer,text,text,jsonb),public.save_workspace_draft(uuid,integer,text,text,jsonb),private.set_selection(uuid,boolean),public.set_selection(uuid,boolean) to authenticated;

-- Append-only submission snapshots. No applicant edits to submitted versions.
create table public.supplier_submission_versions (
 owner_id uuid not null references public.supplier_applications(owner_id),revision integer not null,payload jsonb not null,
 file_manifest jsonb not null,submitted_at timestamptz not null default now(),primary key(owner_id,revision)
);
alter table public.supplier_submission_versions enable row level security;
revoke all on public.supplier_submission_versions from anon,authenticated;
grant select on public.supplier_submission_versions to authenticated;
create policy own_submission on public.supplier_submission_versions for select to authenticated using(owner_id=(select auth.uid()) or (select private.is_reviewer()));
create function private.snapshot_supplier_submission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='submitted' then
  if length(trim(coalesce(new.payload->>'legalName','')))<2 or coalesce(new.payload->>'country','')!~'^[A-Z]{2}$' or coalesce(new.payload->>'attestation','false')<>'true' or jsonb_array_length(coalesce(new.payload->'products','[]'))<1 then raise exception 'INCOMPLETE';end if;
  insert into public.supplier_submission_versions(owner_id,revision,payload,file_manifest)
  select new.owner_id,new.revision,new.payload,coalesce(jsonb_agg(jsonb_build_object('id',f.id,'kind',f.kind,'name',f.name,'size',f.size)),'[]')
  from public.supplier_application_files f where f.owner_id=new.owner_id;
 end if;return new;
end $$;
revoke all on function private.snapshot_supplier_submission() from public,anon,authenticated;
create trigger snapshot_supplier_submission after insert or update on public.supplier_applications for each row execute function private.snapshot_supplier_submission();
-- Serialize metadata changes and submission through the application row lock.
create function private.lock_application_file() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.supplier_applications;own uuid;
begin
 own=case when TG_OP='DELETE' then old.owner_id else new.owner_id end;
 select * into a from public.supplier_applications where owner_id=own for update;
 if auth.uid() is null or own<>auth.uid() or a.status not in ('draft','changes_requested') then raise exception 'LOCKED';end if;
 if TG_OP='INSERT' and (select count(*) from public.supplier_application_files where owner_id=own)>=40 then raise exception 'FILE_LIMIT';end if;
 if TG_OP='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.lock_application_file() from public,anon,authenticated;
create trigger lock_application_file before insert or delete on public.supplier_application_files for each row execute function private.lock_application_file();

create table public.workflow_commands (
 actor_id uuid not null references auth.users(id),command_id uuid not null,action text not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(actor_id,command_id)
);
create table public.notification_outbox (
 id uuid primary key default gen_random_uuid(),event_key text not null unique,recipient_id uuid not null references auth.users(id),
 template text not null,resource_id uuid not null,language text not null default 'en',
 state text not null default 'pending' check(state in ('pending','processing','accepted','delivered','failed')),
 attempts integer not null default 0,available_at timestamptz not null default now(),created_at timestamptz not null default now()
);
create table public.supplier_review_decisions (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.supplier_applications(owner_id),
 revision integer not null,reviewer_id uuid not null references auth.users(id),decision text not null,
 feedback text not null,created_at timestamptz not null default now()
);
alter table public.supplier_applications add column organization_id uuid references public.organizations(id);
alter table public.published_supplier_profiles add column processes text[] not null default '{}';
alter table public.published_supplier_profiles add column materials text[] not null default '{}';
alter table public.published_supplier_profiles add column manufacturing_countries text[] not null default '{}';
alter table public.published_products add column specifications jsonb not null default '{}';
alter table public.rfqs add column sent_snapshot jsonb;
alter table public.offers add column lines jsonb not null default '[]';
alter table public.offers add column exclusions text not null default '';
alter table public.offers add column transport text not null default 'unknown' check(transport in ('included','excluded','unknown'));
alter table public.offers add column currency_decimals integer not null default 2 check(currency_decimals between 0 and 3);
create index supplier_search on public.published_supplier_profiles using gin(to_tsvector('simple',display_name||' '||description));
create index product_search on public.published_products using gin(to_tsvector('simple',name||' '||description));
do $$declare t text;begin
 foreach t in array array['workflow_commands','notification_outbox','supplier_review_decisions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end $$;
grant select on public.supplier_review_decisions to authenticated;
create policy review_feedback_read on public.supplier_review_decisions for select to authenticated using(owner_id=(select auth.uid()) or (select private.is_reviewer()));
create policy reviewer_application_read on public.supplier_applications for select to authenticated using((select private.is_reviewer()));

create or replace function private.seed_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or (new.created_by<>auth.uid() and not private.is_reviewer()) then raise exception 'FORBIDDEN';end if;
 insert into public.memberships(organization_id,user_id,role) values(new.id,new.created_by,'owner');return new;
end $$;
create or replace function private.guard_supplier_application() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if auth.uid() is not null and not private.is_reviewer() and old.status='submitted' and (new.status<>'draft' or new.payload<>old.payload) then raise exception 'Withdraw before editing';end if;
  new.revision=old.revision+1;
 else new.revision=1;end if;
 new.updated_at=now();return new;
end $$;
create or replace function private.record_supplier_application_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and auth.uid()<>new.owner_id and not private.is_reviewer() then raise exception 'Owner mismatch';end if;
 if TG_OP='INSERT' then insert into public.supplier_application_events(owner_id,status) values(new.owner_id,new.status);
 elsif old.status<>new.status then insert into public.supplier_application_events(owner_id,status) values(new.owner_id,new.status);end if;
 return new;
end $$;

-- Atomic commands. PUBLIC wrappers are invoker functions; elevated code stays private.
create function private.workflow(action text,args jsonb,command uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid();result jsonb;app public.supplier_applications;r public.rfqs;t public.threads;
 org uuid;target uuid;thread_id uuid;product uuid;item jsonb;site jsonb;address_id uuid;total numeric=0;line_total numeric;exponent integer;ver integer;
begin
 if actor is null then raise exception 'LOGIN_REQUIRED';end if;
 if command is null or action is null or args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>180000 then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||command::text,0));
 select c.result into result from public.workflow_commands c where c.actor_id=actor and c.command_id=command and c.action=workflow.action;
 if result is not null then return result;end if;
 if action='buyer_company' then
  insert into public.organizations(legal_name,country_code,entity_kind,buyer) values(args->>'name',args->>'country','company',true) returning id into org;
  result=jsonb_build_object('organizationId',org);
 elsif action='review' then
  if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
  select * into app from public.supplier_applications where owner_id=(args->>'owner')::uuid for update;
  if app.owner_id is null or app.revision is distinct from (args->>'revision')::int or app.status not in ('submitted','in_review') then raise exception 'CONFLICT';end if;
  if length(trim(coalesce(args->>'feedback','')))<5 then raise exception 'FEEDBACK_REQUIRED';end if;
  if args->>'decision'='changes_requested' then
   update public.supplier_applications set status='changes_requested',reviewer_notes=args->>'feedback' where owner_id=app.owner_id;
  elsif args->>'decision'='publish' then
   if not exists(select 1 from public.supplier_submission_versions where owner_id=app.owner_id and revision=app.revision) then raise exception 'SUBMISSION_REQUIRED';end if;
   if app.organization_id is not null then raise exception 'REPUBLICATION_REQUIRES_REVIEW';end if;
   insert into public.organizations(created_by,legal_name,trading_name,country_code,entity_kind,legal_form,description,website,supplier)
    values(app.owner_id,app.payload->>'legalName',coalesce(app.payload->>'tradingName',''),app.payload->>'country',app.payload->>'entityKind',coalesce(app.payload->>'legalForm',''),app.payload->>'description',nullif(app.payload->>'website',''),true) returning id into org;
   insert into public.addresses(organization_id,kind,line1,city,region,postal_code,country_code)
    values(org,'registered_office',app.payload#>>'{headquarters,line}',app.payload#>>'{headquarters,city}',coalesce(app.payload#>>'{headquarters,region}',''),coalesce(app.payload#>>'{headquarters,postalCode}',''),app.payload->>'country');
   for site in select value from jsonb_array_elements(coalesce(app.payload->'sites','[]')) loop
    insert into public.addresses(organization_id,kind,line1,city,region,postal_code,country_code)
     values(org,'production',site#>>'{address,line}',site#>>'{address,city}',coalesce(site#>>'{address,region}',''),coalesce(site#>>'{address,postalCode}',''),site#>>'{address,country}') returning id into address_id;
    insert into public.production_sites(organization_id,address_id,name,relationship) values(org,address_id,site->>'name',case when site->>'relationship'='partner' then 'subcontracted' else site->>'relationship' end);
   end loop;
   insert into public.capabilities(organization_id,process,materials,description,equipment)
    values(org,coalesce(app.payload#>>'{capabilities,processes}',''),string_to_array(coalesce(app.payload#>>'{capabilities,materials}',''),','),app.payload->>'description',coalesce(app.payload#>>'{capabilities,equipment}',''));
   for item in select value from jsonb_array_elements(app.payload->'products') loop
    insert into public.products(organization_id,name,model_reference,category,description,specifications)
     values(org,item->>'name',coalesce(nullif(item->>'reference',''),item->>'id'),item->>'category',item->>'description',jsonb_build_object('materials',item->>'materials','processes',item->>'processes','minimum_quantity',item->>'moq','unit',item->>'unit','manufacturing_country',item->>'origin','compliance','not_assessed')) returning id into product;
    insert into public.published_products(product_id,organization_id,source_revision,name,category,description,specifications)
     select id,organization_id,revision,name,category,description,specifications from public.products where id=product;
   end loop;
   -- Publish LAST: related-data triggers withdraw any previous projection.
   insert into public.published_supplier_profiles(organization_id,source_revision,display_name,country_code,city,description,processes,materials,manufacturing_countries)
    select org,o.revision,coalesce(nullif(app.payload->>'tradingName',''),app.payload->>'legalName'),app.payload->>'country',app.payload#>>'{headquarters,city}',app.payload->>'description',string_to_array(coalesce(app.payload#>>'{capabilities,processes}',''),','),string_to_array(coalesce(app.payload#>>'{capabilities,materials}',''),','),array(select distinct s.value#>>'{address,country}' from jsonb_array_elements(coalesce(app.payload->'sites','[]')) s) from public.organizations o where o.id=org;
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
  delete from public.rfq_items where rfq_id=r.id;
  for item in select value from jsonb_array_elements(coalesce(args->'items','[]')) loop
   if nullif(item->>'product','') is not null and not exists(select 1 from public.published_products where product_id=(item->>'product')::uuid and withdrawn_at is null) then raise exception 'NOT_PUBLISHED';end if;
   insert into public.rfq_items(organization_id,rfq_id,description,quantity,unit,selected_product_id) values(org,r.id,item->>'description',(item->>'quantity')::numeric,item->>'unit',nullif(item->>'product','')::uuid);
  end loop;
  result=jsonb_build_object('id',r.id,'revision',r.revision);
 elsif action='send_rfq' then
  select * into r from public.rfqs where id=(args->>'id')::uuid for update;
  if r.id is null or not private.is_member(r.organization_id,array['owner','admin','procurement']) then raise exception 'FORBIDDEN';end if;
  if r.state<>'draft' or r.revision is distinct from (args->>'revision')::int then raise exception 'CONFLICT';end if;
  if length(trim(r.title))<3 or length(trim(r.details))<20 or r.destination_country is null or not exists(select 1 from public.rfq_items where rfq_id=r.id) then raise exception 'INCOMPLETE';end if;
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
  if total>9007199254740991 then raise exception 'AMOUNT_TOO_LARGE';end if;
  select coalesce(max(version),0)+1 into ver from public.offers o where o.thread_id=t.id;
  insert into public.offers(thread_id,supplier_organization_id,version,amount_minor,currency,quantity,unit,terms,lead_time_assumptions,valid_until,lines,transport,exclusions,currency_decimals)
   values(t.id,t.supplier_organization_id,ver,total::bigint,args->>'currency',1,'offer',args->>'terms',args->>'leadTime',(args->>'validUntil')::date,args->'lines',coalesce(args->>'transport','unknown'),coalesce(args->>'exclusions',''),exponent) returning id into target;
  result=jsonb_build_object('id',target,'totalMinor',total::text,'version',ver);
 else raise exception 'UNKNOWN_ACTION';end if;
 insert into public.workflow_commands(actor_id,command_id,action,result) values(actor,command,action,result);
 return result;
end $$;
create function public.workflow(action text,args jsonb,command uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.workflow(action,args,command) $$;
revoke all on function private.workflow(text,jsonb,uuid),public.workflow(text,jsonb,uuid) from public,anon;
grant execute on function private.workflow(text,jsonb,uuid),public.workflow(text,jsonb,uuid) to authenticated;
create function private.review_queue() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_reviewer() then raise exception 'FORBIDDEN';end if;
 return (select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select owner_id,payload,status,revision,updated_at from public.supplier_applications where status in ('submitted','in_review') order by updated_at limit 100) a);
end $$;
create function public.review_queue() returns jsonb language sql security invoker set search_path='' as $$select private.review_queue()$$;
revoke all on function private.review_queue(),public.review_queue() from public,anon;
grant execute on function private.review_queue(),public.review_queue() to authenticated;
