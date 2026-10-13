-- Assisted delivery workflow; no external dispatch, payment, new role or provider is inferred.
create table public.delivery_cases (
 id uuid primary key default gen_random_uuid(), rfq_id uuid not null unique references public.rfqs(id),
 organization_id uuid not null references public.organizations(id), reference text not null unique,
 contact jsonb not null, delivery jsonb not null,preferred_manufacturer uuid,preferred_manufacturer_name text,
 stage text not null default 'draft' check(stage in ('draft','received','qualification','quote_preparation','proposed','accepted','production','ready','shipped','delivered','closed','cancelled')),
 revision integer not null default 1, submitted_at timestamptz,accepted_proposal_id uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.delivery_proposals (
 id uuid primary key default gen_random_uuid(),case_id uuid not null references public.delivery_cases(id),version integer not null,
 currency text not null,data jsonb not null, known_minor bigint not null,firm_minor bigint,valid_until date not null,
 created_at timestamptz not null default now(),unique(case_id,version),unique(case_id,id)
);
alter table public.delivery_cases add constraint accepted_delivery_proposal foreign key(id,accepted_proposal_id) references public.delivery_proposals(case_id,id);
create table private.delivery_financials (proposal_id uuid primary key references public.delivery_proposals(id),commission_minor bigint,created_by uuid not null references auth.users(id));
create table private.logistics_partners (id uuid primary key default gen_random_uuid(),name text not null,coverage text[] not null,contract_confirmed boolean not null default false,note text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create table public.delivery_shipments (id uuid primary key default gen_random_uuid(),case_id uuid not null references public.delivery_cases(id),partner_id uuid references private.logistics_partners(id),data jsonb not null,updated_at timestamptz not null default now());
create table public.delivery_events (id uuid primary key default gen_random_uuid(),case_id uuid not null references public.delivery_cases(id),stage text not null,note text not null,created_at timestamptz not null default now());
create table private.sourcing_commands (actor_id uuid not null references auth.users(id),command_id uuid not null,signature jsonb not null,result jsonb not null,primary key(actor_id,command_id));
create table private.sourcing_imports (id text primary key,digest text not null,source text not null,imported_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create table private.sourcing_import_rows (batch text not null references private.sourcing_imports(id),row_number integer not null,data jsonb not null,primary key(batch,row_number));
create table public.sourcing_manufacturers (
 id uuid primary key,name text not null,country_code text not null check(country_code in ('TR','MA','TN','RS','MK','BA','MD','GE','AL','EG')),
 component_scope boolean not null default false,certifications jsonb not null default '[]' check(jsonb_typeof(certifications)='array'),site text not null,description text not null,source_family text not null,family text,
 source_level text not null check(source_level in ('A','B','C')),qualification text not null default 'unverified' check(qualification in ('explicit','potential','unverified')),
 production_evidence text not null,robotics_application text not null,points_to_confirm text not null,sources jsonb not null check(private.curated_sources_valid(sources)),checked_at date not null,
 production_checked boolean not null default false,public_enabled boolean not null default false,
 delivery_status text not null default 'on_review' check(delivery_status in ('on_review','confirmed','unavailable')),delivery_evidence text not null default '',
 revision integer not null default 1,review_note text not null default '',reviewed_by uuid references auth.users(id),reviewed_at timestamptz
);
create table private.delivery_payment_events (id uuid primary key default gen_random_uuid(),provider text not null,provider_event_id text not null unique,proposal_id uuid not null references public.delivery_proposals(id),status text not null check(status in ('pending','paid','failed')),amount_minor bigint not null,currency text not null,verified_at timestamptz not null);
-- No public RPC records a payment. A future server integration must verify signed provider callbacks.
create function private.can_read_delivery(case_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.delivery_cases c where c.id=case_uuid and (private.is_member(c.organization_id,array['owner','admin','procurement']) or (c.submitted_at is not null and private.admin_has_permission('contacts.read'))))
$$;
do $$declare t text;begin
 foreach t in array array['delivery_cases','delivery_proposals','delivery_shipments','delivery_events','sourcing_manufacturers'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 foreach t in array array['delivery_financials','logistics_partners','sourcing_commands','sourcing_imports','sourcing_import_rows','delivery_payment_events'] loop
  execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);
 end loop;
end$$;
grant select on public.delivery_cases,public.delivery_proposals,public.delivery_shipments,public.delivery_events to authenticated;
create policy delivery_case_read on public.delivery_cases for select to authenticated using(private.can_read_delivery(id));
create policy delivery_proposal_read on public.delivery_proposals for select to authenticated using(private.can_read_delivery(case_id));
create policy delivery_shipment_read on public.delivery_shipments for select to authenticated using(private.can_read_delivery(case_id));
create policy delivery_event_read on public.delivery_events for select to authenticated using(private.can_read_delivery(case_id));
grant execute on function private.can_read_delivery(uuid) to authenticated;
grant select(id,name,country_code,site,description,source_family,family,source_level,qualification,production_evidence,robotics_application,points_to_confirm,sources,checked_at,production_checked,public_enabled,delivery_status,delivery_evidence,certifications,reviewed_at,revision) on public.sourcing_manufacturers to anon,authenticated;
create policy sourcing_manufacturer_public on public.sourcing_manufacturers for select to anon,authenticated using(public_enabled and production_checked and qualification<>'unverified');
create trigger delivery_proposal_immutable before update or delete on public.delivery_proposals for each row execute function private.admin_audit_immutable();
create trigger delivery_event_immutable before update or delete on public.delivery_events for each row execute function private.admin_audit_immutable();

-- Server validation is duplicated in SQL because PostgREST RPCs are callable without the Next API.
create function private.delivery_keys(v jsonb,required_keys text[],optional_keys text[] default array[]::text[]) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(v)='object' and v ?& required_keys and not exists(select 1 from unnest(required_keys) k where v->k='null'::jsonb) and not exists(select 1 from jsonb_object_keys(v) k where not k=any(required_keys||optional_keys))
$$;
revoke all on function private.delivery_keys(jsonb,text[],text[]) from public,anon,authenticated;
create function private.delivery_cost_valid(v jsonb) returns boolean language sql immutable set search_path='' as $$
 select private.delivery_keys(v,array['status','note'],array['amountMinor']) and v->>'status' in ('confirmed','estimated','pending','excluded') and length(coalesce(v->>'note',''))<=1000
 and case when v->>'status' in ('confirmed','estimated') then jsonb_typeof(v->'amountMinor')='string' and v->>'amountMinor' ~ '^[0-9]{1,14}$' else v->'amountMinor'='null'::jsonb end
 and (v->>'status'='confirmed' or length(trim(coalesce(v->>'note','')))>0)
$$;
create function private.delivery_event(case_uuid uuid,stage_name text,note_text text) returns void language sql set search_path='' as $$
 insert into public.delivery_events(case_id,stage,note) values(case_uuid,stage_name,note_text)
$$;
create function private.sourcing_command(action text,args jsonb,command uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();signature jsonb:=jsonb_build_object('action',action,'args',args);saved private.sourcing_commands;c public.delivery_cases;r public.rfqs;
 p jsonb;x jsonb;v jsonb;k text;proposal public.delivery_proposals;known numeric:=0;firm boolean:=true;ver integer;target uuid;pid uuid;org uuid;result jsonb;is_buyer boolean;previous_stage text;partner private.logistics_partners;m public.sourcing_manufacturers;deadline_date date;
begin
 if actor is null then raise exception 'LOGIN_REQUIRED';end if;
 if not private.admin_user_is_active(actor) then raise exception 'FORBIDDEN';end if;
 if command is null or args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>120000 then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||command::text,170));
 select * into saved from private.sourcing_commands where actor_id=actor and command_id=command;
 if saved.actor_id is not null then if saved.signature<>signature then raise exception 'CONFLICT';end if;return saved.result;end if;
 if action='partner' then
  perform private.lock_admin_permission('contacts.manage');
  if length(trim(coalesce(args->>'name','')))<2 or length(args->>'name')>200 or length(trim(coalesce(args->>'note','')))<10 or length(args->>'note')>2000 or jsonb_typeof(args->'contractConfirmed')<>'boolean' or jsonb_typeof(args->'coverage')<>'array' or jsonb_array_length(args->'coverage') not between 1 and 10 or exists(select 1 from jsonb_array_elements_text(args->'coverage') where value not in ('TR','MA','TN','RS','MK','BA','MD','GE','AL','EG')) then raise exception 'INVALID';end if;
  insert into private.logistics_partners(name,coverage,contract_confirmed,note,created_by) values(args->>'name',array(select jsonb_array_elements_text(args->'coverage')),(args->>'contractConfirmed')::boolean,args->>'note',actor) returning id into target;
  result:=jsonb_build_object('id',target);
 elsif action='qualify' then
  perform private.lock_admin_permission('access.manage');
  select * into m from public.sourcing_manufacturers where id=(args->>'id')::uuid for update;
  if m.id is null then raise exception 'INVALID';end if;
  if m.revision is distinct from (args->>'revision')::integer then raise exception 'CONFLICT';end if;
  if args->>'family' not in ('actionnement-transmission','transmissions-guidages','capteurs-vision','commande-electronique','cables-connecteurs','energie-batteries','prehension','pieces-mecaniques') or args->>'level' not in ('explicit','potential','unverified') or args->>'delivery' not in ('on_review','confirmed','unavailable') or length(trim(coalesce(args->>'reviewNote','')))<10 or length(args->>'reviewNote')>4000 or jsonb_typeof(args->'publicEnabled')<>'boolean' or jsonb_typeof(args->'productionChecked')<>'boolean' or length(coalesce(args->>'deliveryEvidence',''))>2000 then raise exception 'INVALID';end if;
  if (args->>'publicEnabled')::boolean and (not m.component_scope or (m.source_level='C' and (length(trim(coalesce(args->>'productionEvidence','')))<30 or coalesce(jsonb_array_length(args->'sourceUpdates'),0)=0)) or args->>'level'='unverified' or not (args->>'productionChecked')::boolean) then raise exception 'INCOMPLETE';end if;
  if args->>'level'='explicit' and (m.source_level<>'A' or length(m.robotics_application)<20) then raise exception 'INVALID';end if;
  if args->>'delivery'='confirmed' and length(trim(coalesce(args->>'deliveryEvidence','')))<10 then raise exception 'INCOMPLETE';end if;
  if not private.curated_public_payload_is_safe(jsonb_build_object('productionEvidence',args->'productionEvidence','roboticsApplication',args->'roboticsApplication','pointsToConfirm',args->'pointsToConfirm','sources',args->'sourceUpdates','certifications',args->'certifications','deliveryEvidence',args->'deliveryEvidence')) then raise exception 'INVALID';end if;
  if length(coalesce(args->>'productionEvidence',''))>4000 or length(coalesce(args->>'roboticsApplication',''))>4000 or length(coalesce(args->>'pointsToConfirm',''))>4000 or jsonb_typeof(coalesce(args->'sourceUpdates','[]'::jsonb))<>'array' or (coalesce(jsonb_array_length(args->'sourceUpdates'),0)>0 and private.curated_sources_valid(args->'sourceUpdates') is distinct from true) then raise exception 'INVALID';end if;
  if jsonb_typeof(coalesce(args->'certifications','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(args->'certifications','[]'::jsonb))>20 then raise exception 'INVALID';end if;
  for x in select value from jsonb_array_elements(coalesce(args->'certifications','[]'::jsonb)) loop
   if length(trim(coalesce(x->>'name','')))<2 or length(x->>'name')>200 or length(trim(coalesce(x->>'issuer','')))<2 or length(x->>'issuer')>200 or length(trim(coalesce(x->>'scope','')))<5 or length(x->>'scope')>2000 or coalesce(x->>'url','')!~'^https://[[:alnum:]][^[:space:]<>"@]*$' or length(x->>'url')>2048 or (x->>'checkedAt')::date>current_date or length(coalesce(x->>'note',''))>1000 then raise exception 'INVALID';end if;
   if nullif(x->>'validUntil','') is not null and (x->>'validUntil')::date<(x->>'checkedAt')::date then raise exception 'INVALID';end if;
  end loop;
  update public.sourcing_manufacturers set reviewed_at=now(),sources=sources||coalesce(args->'sourceUpdates','[]'::jsonb),production_evidence=coalesce(nullif(args->>'productionEvidence',''),production_evidence),robotics_application=coalesce(nullif(args->>'roboticsApplication',''),robotics_application),points_to_confirm=coalesce(nullif(args->>'pointsToConfirm',''),points_to_confirm),certifications=coalesce(args->'certifications','[]'::jsonb),family=args->>'family',qualification=args->>'level',production_checked=(args->>'productionChecked')::boolean,public_enabled=(args->>'publicEnabled')::boolean,delivery_status=args->>'delivery',delivery_evidence=args->>'deliveryEvidence',review_note=args->>'reviewNote',reviewed_by=actor,revision=revision+1 where id=m.id;
  insert into private.admin_events(actor_id,action,resource_id) values(actor,'component_qualification',m.id);
  result:=jsonb_build_object('id',m.id);
 elsif action='create' then
  if private.delivery_keys(args,array['organization','title','details','items','contact','delivery'],array['preferredManufacturer']) is distinct from true or private.delivery_keys(args->'contact',array['name','company','email'],array['phone']) is distinct from true or private.delivery_keys(args->'delivery',array['country','postalCode','city','transport','customs'],array['deadline','address','notes']) is distinct from true then raise exception 'INVALID';end if;
  org:=(args->>'organization')::uuid;
  if not private.is_member(org,array['owner','admin','procurement']) or not exists(select 1 from public.organizations where id=org and buyer) then raise exception 'FORBIDDEN';end if;
  if length(trim(coalesce(args->>'title','')))<3 or length(args->>'title')>160 or length(trim(coalesce(args->>'details','')))<20 or length(args->>'details')>10000
   or jsonb_typeof(args->'items') is distinct from 'array' or jsonb_array_length(args->'items') not between 1 and 50
   or jsonb_typeof(args->'contact') is distinct from 'object' or length(trim(coalesce(args#>>'{contact,name}','')))<2 or length(args#>>'{contact,name}')>160 or length(trim(coalesce(args#>>'{contact,company}','')))<2 or length(args#>>'{contact,company}')>200 or coalesce(args#>>'{contact,email}','')!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(args#>>'{contact,email}')>254 or length(coalesce(args#>>'{contact,phone}',''))>60
   or jsonb_typeof(args->'delivery') is distinct from 'object' or args#>>'{delivery,country}' not in ('AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE') or length(trim(coalesce(args#>>'{delivery,postalCode}','')))<2 or length(args#>>'{delivery,postalCode}')>32 or length(trim(coalesce(args#>>'{delivery,city}','')))<2 or length(args#>>'{delivery,city}')>160 or length(coalesce(args#>>'{delivery,address}',''))>400 or length(coalesce(args#>>'{delivery,notes}',''))>1000 or jsonb_typeof(args#>'{delivery,transport}') is distinct from 'boolean' or jsonb_typeof(args#>'{delivery,customs}') is distinct from 'boolean' then raise exception 'INVALID';end if;
  if nullif(args#>>'{delivery,deadline}','') is not null then deadline_date:=(args#>>'{delivery,deadline}')::date;if deadline_date<current_date then raise exception 'INVALID';end if;end if;
  for x in select value from jsonb_array_elements(args->'items') loop
   if private.delivery_keys(x,array['description','quantity','unit'],array['product','candidate']) is distinct from true then raise exception 'INVALID';end if;
   if x ? 'product' and not exists(select 1 from public.component_products where product_id=(x->>'product')::uuid) then raise exception 'INVALID';end if;
   if coalesce(x->>'quantity','')!~'^[0-9]{1,12}([.][0-9]{1,4})?$' or (x->>'quantity')::numeric<=0 or (x->>'quantity')::numeric>1e12 or length(trim(coalesce(x->>'description','')))<2 or length(x->>'description')>1000 or x->>'unit' not in ('pcs','kg','m','m2','set') or (x ? 'product' and x ? 'candidate') then raise exception 'INVALID';end if;
   if x ? 'candidate' and not exists(select 1 from public.sourcing_manufacturers where id=(x->>'candidate')::uuid and public_enabled and production_checked and qualification<>'unverified') then raise exception 'INVALID';end if;
  end loop;
  if args ? 'preferredManufacturer' and not exists(select 1 from public.component_supplier_profiles s where s.organization_id=(args->>'preferredManufacturer')::uuid) then raise exception 'INVALID';end if;
  result:=private.workflow('save_rfq',jsonb_build_object('organization',org,'title',args->>'title','details',args->>'details','destination',args#>>'{delivery,country}','items',args->'items'),command);
  pid:=(result->>'id')::uuid;
  update public.rfqs set deadline=deadline_date where id=pid;
  -- Candidate references are editorial capabilities, not supplier accounts or contractual commitments.
  for x in select value from jsonb_array_elements(args->'items') loop
   if x ? 'candidate' then update public.rfq_items set specifications=jsonb_build_object('candidate_id',x->>'candidate') where id=(select id from public.rfq_items where rfq_id=pid and description=x->>'description' and quantity=(x->>'quantity')::numeric and unit=x->>'unit' and specifications='{}'::jsonb and selected_product_id is null order by id limit 1);end if;
  end loop;
  target:=gen_random_uuid();insert into public.delivery_cases(id,rfq_id,organization_id,reference,contact,delivery,preferred_manufacturer,preferred_manufacturer_name) values(target,pid,org,'GSL-'||to_char(current_date,'YYMMDD')||'-'||upper(substr(replace(target::text,'-',''),1,12)),args->'contact',args->'delivery',nullif(args->>'preferredManufacturer','')::uuid,(select display_name from public.component_supplier_profiles where organization_id=nullif(args->>'preferredManufacturer','')::uuid));
  perform private.delivery_event(target,'draft','Brouillon privé enregistré. Aucun destinataire consulté.');
  result:=jsonb_build_object('id',target,'rfqId',pid,'reference',(select reference from public.delivery_cases where id=target),'revision',1,'organization',org);
 else
  select * into c from public.delivery_cases where id=(args->>'id')::uuid for update;
  if c.id is null then raise exception 'FORBIDDEN';end if;
  is_buyer:=private.is_member(c.organization_id,array['owner','admin','procurement']);
  if action in ('submit','accept','cancel') then if not is_buyer then raise exception 'FORBIDDEN';end if;
  else perform private.lock_admin_permission('contacts.manage');if c.submitted_at is null then raise exception 'FORBIDDEN';end if;end if;
  if c.revision is distinct from (args->>'revision')::integer then raise exception 'CONFLICT';end if;
  previous_stage:=c.stage;
  if action='submit' then
   if c.stage<>'draft' then raise exception 'CONFLICT';end if;
   select * into r from public.rfqs where id=c.rfq_id for update;
   if r.state<>'draft' or jsonb_array_length(r.draft_items)<>(select count(*) from public.rfq_items where rfq_id=r.id) then raise exception 'INCOMPLETE';end if;
   if exists(select 1 from public.rfq_items i where i.rfq_id=r.id and ((i.selected_product_id is not null and not exists(select 1 from public.component_products p where p.product_id=i.selected_product_id)) or (i.specifications ? 'candidate_id' and not exists(select 1 from public.sourcing_manufacturers sm where sm.id=(i.specifications->>'candidate_id')::uuid and sm.public_enabled and sm.production_checked and sm.qualification<>'unverified')))) then raise exception 'INCOMPLETE';end if;
   -- Existing scan trigger and row locks freeze attachments atomically at explicit consent.
   update public.rfqs set mode='autonomous',assistance_shared_at=null,state='sent' where id=r.id;
   update public.delivery_cases set stage='received',submitted_at=now() where id=c.id;
   perform private.delivery_event(c.id,'received','Demande enregistrée dans la file GSL après confirmation de partage. Aucun email ni transport déclenché.');
  elsif action='cancel' then
   if c.stage not in ('draft','received','qualification','quote_preparation','proposed') or length(trim(coalesce(args->>'note','')))<5 or length(args->>'note')>2000 then raise exception 'CONFLICT';end if;
   update public.delivery_cases set stage='cancelled' where id=c.id;update public.rfqs set state='cancelled' where id=c.rfq_id;
   perform private.delivery_event(c.id,'cancelled',args->>'note');
  elsif action='stage' then
   if length(trim(coalesce(args->>'note','')))<10 or length(args->>'note')>2000 then raise exception 'INVALID';end if;
   if not ((c.stage='received' and args->>'stage'='qualification') or (c.stage='qualification' and args->>'stage'='quote_preparation') or (c.stage='accepted' and args->>'stage'='production') or (c.stage='production' and args->>'stage'='ready') or (c.stage='ready' and args->>'stage'='shipped') or (c.stage='shipped' and args->>'stage'='delivered') or (c.stage='delivered' and args->>'stage'='closed') or (args->>'stage'='cancelled' and c.stage not in ('closed','cancelled'))) then raise exception 'CONFLICT';end if;
   if args->>'stage'='shipped' and (not exists(select 1 from public.delivery_shipments where case_id=c.id) or exists(select 1 from public.delivery_shipments s left join private.logistics_partners l on l.id=s.partner_id where s.case_id=c.id and (l.id is null or not l.contract_confirmed or not (s.data->>'originCountry'=any(l.coverage)) or coalesce(s.data->>'trackingNumber','')='' or coalesce(s.data->>'importerRole','to_confirm')='to_confirm' or coalesce(s.data->>'importerName','')='' or jsonb_array_length(s.data->'documents')=0))) then raise exception 'INCOMPLETE';end if;
   update public.delivery_cases set stage=args->>'stage' where id=c.id;perform private.delivery_event(c.id,args->>'stage',args->>'note');
  elsif action='proposal' then
   if c.stage not in ('quote_preparation','proposed') then raise exception 'CONFLICT';end if;
   p:=args->'proposal';
   if private.delivery_keys(p,array['currency','products','costs','validUntil','leadTime','paymentTerms','exclusions','note'],array['commissionMinor','customsEvidence']) is distinct from true then raise exception 'INVALID';end if;
   if jsonb_typeof(p) is distinct from 'object' or p->>'currency' not in ('EUR','USD','GBP','JPY','KRW','BHD','KWD','TND','CNY','TRY','GEL','MAD','CHF','CAD','AUD','PLN','RON') or length(trim(coalesce(p->>'paymentTerms','')))<3 or length(p->>'paymentTerms')>2000 or length(trim(coalesce(p->>'leadTime','')))<3 or length(p->>'leadTime')>1000 or length(coalesce(p->>'exclusions',''))>4000 or length(coalesce(p->>'note',''))>4000 or jsonb_typeof(p->'products') is distinct from 'array' or jsonb_array_length(p->'products') not between 1 and 50 then raise exception 'INVALID';end if;
   if (p->>'validUntil')::date<current_date then raise exception 'EXPIRED';end if;
   if jsonb_array_length(p->'products')<>(select count(*) from public.rfq_items where rfq_id=c.rfq_id) or (select count(distinct value->>'itemId') from jsonb_array_elements(p->'products'))<>jsonb_array_length(p->'products') then raise exception 'INCOMPLETE';end if;
   for x in select value from jsonb_array_elements(p->'products') loop
    if not exists(select 1 from public.rfq_items where id=(x->>'itemId')::uuid and rfq_id=c.rfq_id) or jsonb_typeof(x->'amountMinor') is distinct from 'string' or x->>'amountMinor'!~'^[0-9]{1,14}$' or x->>'status' not in ('confirmed','estimated') or length(coalesce(x->>'note',''))>1000 then raise exception 'INVALID';end if;
    known:=known+(x->>'amountMinor')::numeric;firm:=firm and x->>'status'='confirmed';
   end loop;
   foreach k in array array['transport','insurance','coordination','duties','taxes'] loop
    v:=p#>array['costs',k];if private.delivery_cost_valid(v) is distinct from true then raise exception 'INVALID';end if;
    known:=known+coalesce((v->>'amountMinor')::numeric,0);firm:=firm and v->>'status'='confirmed';
   end loop;
   firm:=firm and length(trim(coalesce(p->>'exclusions','')))=0;
   if jsonb_typeof(coalesce(p->'customsEvidence','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p->'customsEvidence','[]'::jsonb))>50 then raise exception 'INVALID';end if;
   for x in select value from jsonb_array_elements(coalesce(p->'customsEvidence','[]'::jsonb)) loop
    if not exists(select 1 from public.rfq_items where rfq_id=c.rfq_id and id=(x->>'itemId')::uuid) or x->>'originCountry' not in ('TR','MA','TN','RS','MK','BA','MD','GE','AL','EG') or length(trim(coalesce(x->>'productCode','')))<4 or length(x->>'productCode')>20 or coalesce(x->>'sourceUrl','')!~'^https://[[:alnum:]][^[:space:]<>"@]*$' or length(x->>'sourceUrl')>2048 or (x->>'checkedAt')::date>current_date or length(trim(coalesce(x->>'note','')))<10 or length(x->>'note')>2000 then raise exception 'INVALID';end if;
   end loop;
   if p#>>'{costs,duties,status}'='confirmed' and exists(select 1 from public.rfq_items i where i.rfq_id=c.rfq_id and not exists(select 1 from jsonb_array_elements(coalesce(p->'customsEvidence','[]'::jsonb)) ev(value) where ev.value->>'itemId'=i.id::text)) then raise exception 'INCOMPLETE';end if;
   if known>9007199254740991 then raise exception 'INVALID';end if;
   if nullif(p->>'commissionMinor','') is not null and p->>'commissionMinor'!~'^[0-9]{1,14}$' then raise exception 'INVALID';end if;
   select coalesce(max(version),0)+1 into ver from public.delivery_proposals where case_id=c.id;
   insert into public.delivery_proposals(case_id,version,currency,data,known_minor,firm_minor,valid_until) values(c.id,ver,p->>'currency',p-'commissionMinor',known::bigint,case when firm then known::bigint end,(p->>'validUntil')::date) returning id into target;
   insert into private.delivery_financials(proposal_id,commission_minor,created_by) values(target,nullif(p->>'commissionMinor','')::bigint,actor);
   update public.delivery_cases set stage='proposed' where id=c.id;perform private.delivery_event(c.id,'proposed','Proposition version '||ver||' disponible. Modalités de paiement à convenir ; aucun paiement effectué.');
  elsif action='accept' then
   if c.stage<>'proposed' or args->>'acknowledged'<>'true' then raise exception 'CONFLICT';end if;
   select * into proposal from public.delivery_proposals where id=(args->>'proposalId')::uuid and case_id=c.id;
   if proposal.id is null or proposal.version<>(select max(version) from public.delivery_proposals where case_id=c.id) then raise exception 'CONFLICT';end if;
   if proposal.valid_until<current_date then raise exception 'EXPIRED';end if;
   if exists(select 1 from jsonb_array_elements(proposal.data->'products') where value->>'status'<>'confirmed') then raise exception 'INCOMPLETE';end if;
   update public.delivery_cases set stage='accepted',accepted_proposal_id=proposal.id where id=c.id;
   perform private.delivery_event(c.id,'accepted','Proposition version '||proposal.version||' retenue par l’acheteur avec ses conditions et exclusions. Aucun paiement effectué.');
  elsif action='shipment' then
   if c.stage in ('closed','cancelled') then raise exception 'CONFLICT';end if;
   p:=args->'shipment';
   if private.delivery_keys(p,array['originCountry','origin','destination','packages','weightKg','dimensions','goods','constraints','mode','incoterm','agreedPlace','importerRole','importerName','insurance','documents','trackingNumber','trackingUrl','note'],array['id','partnerId']) is distinct from true then raise exception 'INVALID';end if;
   if jsonb_typeof(p) is distinct from 'object' or p->>'originCountry' not in ('TR','MA','TN','RS','MK','BA','MD','GE','AL','EG') or length(trim(coalesce(p->>'origin','')))<2 or length(p->>'origin')>400 or length(trim(coalesce(p->>'destination','')))<2 or length(p->>'destination')>400 or (p->>'packages')!~'^[0-9]{1,6}$' or (p->>'packages')::integer not between 1 and 100000 or coalesce(p->>'weightKg','')!~'^[0-9]{1,10}([.][0-9]{1,3})?$' or (p->>'weightKg')::numeric<=0 or length(trim(coalesce(p->>'dimensions','')))<3 or length(p->>'dimensions')>1000 or length(trim(coalesce(p->>'goods','')))<3 or length(p->>'goods')>1000 or length(coalesce(p->>'constraints',''))>1000 or p->>'mode' not in ('road','sea','air','rail','multimodal') or p->>'incoterm' not in ('EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF') or length(trim(coalesce(p->>'agreedPlace','')))<2 or length(p->>'agreedPlace')>400 or p->>'importerRole' not in ('buyer','manufacturer','other','to_confirm') or length(coalesce(p->>'importerName',''))>200 or length(coalesce(p->>'insurance',''))>1000 or jsonb_typeof(p->'documents') is distinct from 'array' or jsonb_array_length(p->'documents')>30 or exists(select 1 from jsonb_array_elements(p->'documents') where jsonb_typeof(value)<>'string' or length(value#>>'{}') not between 1 and 200) or length(coalesce(p->>'trackingNumber',''))>200 or length(coalesce(p->>'trackingUrl',''))>2048 or (coalesce(p->>'trackingUrl','')<>'' and p->>'trackingUrl'!~'^https://[[:alnum:]][^[:space:]<>"@]*$') or length(coalesce(p->>'note',''))>2000 then raise exception 'INVALID';end if;
   pid:=nullif(p->>'partnerId','')::uuid;
   if pid is not null and not exists(select 1 from private.logistics_partners where id=pid and p->>'originCountry'=any(coverage)) then raise exception 'INVALID';end if;
   if nullif(p->>'id','') is null then insert into public.delivery_shipments(case_id,partner_id,data) values(c.id,pid,p) returning id into target;
   else target:=(p->>'id')::uuid;update public.delivery_shipments set partner_id=pid,data=p,updated_at=now() where id=target and case_id=c.id;if not found then raise exception 'FORBIDDEN';end if;end if;
   perform private.delivery_event(c.id,c.stage,'Données logistiques actualisées manuellement. Aucun enlèvement déclenché.');
  else raise exception 'INVALID';end if;
  update public.delivery_cases set revision=revision+1,updated_at=now() where id=c.id returning * into c;
  result:=jsonb_build_object('id',c.id,'revision',c.revision,'reference',c.reference,'stage',c.stage);
 end if;
 insert into private.sourcing_commands(actor_id,command_id,signature,result) values(actor,command,signature,result);
 return result;
end$$;
create function public.sourcing_command(action text,args jsonb,command uuid) returns jsonb language sql security invoker set search_path='' as $$select private.sourcing_command(action,args,command)$$;
revoke all on function private.delivery_cost_valid(jsonb),private.delivery_event(uuid,text,text),private.sourcing_command(text,jsonb,uuid),public.sourcing_command(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.sourcing_command(text,jsonb,uuid),public.sourcing_command(text,jsonb,uuid) to authenticated;

create function private.sourcing_snapshot(admin_view boolean,case_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare visible uuid[];result jsonb;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if admin_view then perform private.require_admin_permission('contacts.read');end if;
 select array_agg(id) into visible from (select c.id from public.delivery_cases c where (case_id is null or c.id=case_id) and private.can_read_delivery(c.id) and (not admin_view or c.submitted_at is not null) order by c.updated_at desc,c.id limit 100)c;
 if case_id is not null and coalesce(cardinality(visible),0)=0 then raise exception 'FORBIDDEN';end if;
 result:=jsonb_build_object('cases',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('title',r.title,'details',r.details) order by c.updated_at desc) from public.delivery_cases c join public.rfqs r on r.id=c.rfq_id where c.id=any(visible)),'[]'),
 'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.rfq_items i join public.delivery_cases c on c.rfq_id=i.rfq_id where c.id=any(visible)),'[]'),
 'proposals',coalesce((select jsonb_agg(to_jsonb(p)||case when admin_view then jsonb_build_object('commissionMinor',f.commission_minor::text) else '{}' end order by p.version desc) from public.delivery_proposals p left join private.delivery_financials f on f.proposal_id=p.id where p.case_id=any(visible)),'[]'),
 'shipments',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('partnerName',l.name)) from public.delivery_shipments s left join private.logistics_partners l on l.id=s.partner_id where s.case_id=any(visible)),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id) from public.delivery_events e where e.case_id=any(visible)),'[]'),
 'payment',jsonb_build_object('configured',false,'mode','terms_to_agree'),'logistics',jsonb_build_object('configured',false,'mode','manual_quotes'),'limit',100);
 if admin_view then
  result:=result||jsonb_build_object('partners',coalesce((select jsonb_agg(to_jsonb(l)-'created_by') from private.logistics_partners l),'[]'),'canManage',private.admin_has_permission('contacts.manage'),'canQualify',private.admin_has_permission('access.manage'));
  if private.admin_has_permission('access.manage') then result:=result||jsonb_build_object('manufacturers',coalesce((select jsonb_agg(to_jsonb(m)-'reviewed_by' order by m.name) from public.sourcing_manufacturers m),'[]'));end if;
 end if;
 return result;
end$$;
create function public.sourcing_snapshot(admin_view boolean default false,case_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.sourcing_snapshot(admin_view,case_id)$$;
revoke all on function private.sourcing_snapshot(boolean,uuid),public.sourcing_snapshot(boolean,uuid) from public,anon,authenticated;
grant execute on function private.sourcing_snapshot(boolean,uuid),public.sourcing_snapshot(boolean,uuid) to authenticated;

-- Ready, scanned documents may be read by authorized GSL administrators after explicit submission.
create function private.can_read_delivery_file(file_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.admin_has_permission('contacts.read') and exists(select 1 from public.rfq_files a join public.delivery_cases c on c.rfq_id=a.rfq_id join public.files f on f.id=a.file_id where a.file_id=file_uuid and c.submitted_at is not null and a.recipient_organization_id is null and f.upload_state='ready' and f.scan_status='clean')
$$;
grant execute on function private.can_read_delivery_file(uuid) to authenticated;
create policy delivery_files_read on public.files for select to authenticated using(private.can_read_delivery_file(id));
create policy delivery_rfq_files_read on public.rfq_files for select to authenticated using(private.can_read_delivery_file(file_id));
create policy delivery_storage_read on storage.objects for select to authenticated using(bucket_id='gsl-private' and exists(select 1 from public.files f where f.object_path=name and private.can_read_delivery_file(f.id)));
-- Historical RFQ commands cannot bypass case revisions, consent or selected proposal versions.
create or replace function private.workflow(action text,args jsonb,command uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if command is null or action is null or args is null then raise exception 'INVALID';end if;
 if action in ('save_rfq','send_rfq','cancel_rfq','select_offer','share_assistance','add_recipient') and nullif(args->>'id','') is not null and exists(select 1 from public.delivery_cases where rfq_id=(args->>'id')::uuid) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||command::text,0));
 insert into private.command_inputs(actor_id,command_id,action,args) values(auth.uid(),command,action,args) on conflict do nothing;
 if not exists(select 1 from private.command_inputs i where i.actor_id=auth.uid() and i.command_id=command and i.action=workflow.action and i.args=workflow.args) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 return private.workflow_impl(action,args,command);
end$$;

create function private.import_component_candidates(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row jsonb;batch text;digest text;previous private.sourcing_imports;n integer:=0;
begin
 perform private.lock_admin_permission('access.manage');
 if input->>'schemaVersion'<>'1' or length(coalesce(input->>'batchId','')) not between 3 and 100 or coalesce(input->>'sourceDigest','')!~'^[a-f0-9]{64}$' or length(coalesce(input->>'source','')) not between 5 and 1000 or jsonb_typeof(input->'rows') is distinct from 'array' or jsonb_array_length(input->'rows') not between 1 and 1000 or not private.curated_public_payload_is_safe(input) then raise exception 'INVALID';end if;
 batch:=input->>'batchId';digest:=input->>'sourceDigest';perform pg_advisory_xact_lock(hashtextextended('component-import:'||batch,171));
 select * into previous from private.sourcing_imports where id=batch;
 if previous.id is not null then if previous.digest<>digest then raise exception 'CONFLICT';end if;return jsonb_build_object('imported',0,'existing',true);end if;
 insert into private.sourcing_imports(id,digest,source,imported_by) values(batch,digest,input->>'source',auth.uid());
 for row in select value from jsonb_array_elements(input->'rows') loop
  if row->>'sourceLevel' not in ('A','B','C') or row->>'country' not in ('TR','MA','TN','RS','MK','BA','MD','GE','AL','EG') or length(trim(coalesce(row->>'name','')))<2 or length(row->>'name')>200 or length(coalesce(row->>'site',''))>400 or length(coalesce(row->>'description',''))>4000 or length(coalesce(row->>'productionEvidence',''))>4000 or length(coalesce(row->>'roboticsApplication',''))>4000 or length(coalesce(row->>'pointsToConfirm',''))>4000 or (row->>'checkedAt')::date>current_date or private.curated_sources_valid(row->'sources') is distinct from true then raise exception 'INVALID';end if;
  insert into private.sourcing_import_rows(batch,row_number,data) values(batch,(row->>'rowNumber')::int,row);
  insert into public.sourcing_manufacturers(id,name,country_code,site,description,source_family,source_level,production_evidence,robotics_application,points_to_confirm,sources,checked_at,component_scope)
   values((row->>'id')::uuid,row->>'name',row->>'country',coalesce(row->>'site',''),coalesce(row->>'description',''),coalesce(row->>'sourceFamily',''),row->>'sourceLevel',coalesce(row->>'productionEvidence',''),coalesce(row->>'roboticsApplication',''),coalesce(row->>'pointsToConfirm',''),row->'sources',(row->>'checkedAt')::date,(row->>'componentScope')::boolean);
  n:=n+1;
 end loop;
 insert into private.admin_events(actor_id,action,resource_id) values(auth.uid(),'component_source_import',gen_random_uuid());
 return jsonb_build_object('imported',n,'published',0,'existing',false);
end$$;
create function public.import_component_candidates(input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.import_component_candidates(input)$$;
revoke all on function private.import_component_candidates(jsonb),public.import_component_candidates(jsonb) from public,anon,authenticated;
grant execute on function private.import_component_candidates(jsonb),public.import_component_candidates(jsonb) to authenticated;

-- Only reviewed component offers appear publicly. Complete robots and old general offers stay in their original records.
create view public.component_products with(security_invoker=true) as
 select p.product_id,p.organization_id,p.source_revision,p.name,
 case p.category when 'mecanique-cablage' then 'pieces-mecaniques' else p.category end as category,p.description,p.published_at,p.withdrawn_at,
 p.specifications||jsonb_build_object('qualification','explicit','delivery_status','on_review') as specifications
 from public.robotics_products p where p.category<>'robots-plateformes'
 union all
 select m.id,m.id,m.revision,m.description,m.family,m.robotics_application,m.checked_at::timestamptz,null::timestamptz,
 jsonb_build_object('candidate_id',m.id::text,'manufacturing_country',m.country_code,'robotics_family',m.family,'qualification',m.qualification,'robotics_site',m.site,'robotics_offer',m.description,'robotics_checked_at',m.checked_at::text,'robotics_sources',m.sources::text,'production_evidence',m.production_evidence,'points_to_confirm',m.points_to_confirm,'delivery_status',m.delivery_status,'delivery_evidence',m.delivery_evidence,'processes',m.description,'certifications',coalesce((select string_agg(x->>'name',' · ') from jsonb_array_elements(m.certifications) x where nullif(x->>'validUntil','') is not null and (x->>'validUntil')::date>=current_date),''),'certification_documented',case when exists(select 1 from jsonb_array_elements(m.certifications) x where nullif(x->>'validUntil','') is not null and (x->>'validUntil')::date>=current_date) then 'true' else 'false' end)
 from public.sourcing_manufacturers m where m.public_enabled and m.production_checked and m.qualification<>'unverified';
grant select on public.component_products to anon,authenticated;
create view public.component_supplier_profiles with(security_invoker=true) as
 select s.organization_id,s.display_name,s.country_code,s.city,s.description,s.processes,s.materials,s.published_at,s.public_details,s.withdrawn_at
 from public.published_supplier_profiles s where exists(select 1 from public.component_products p where p.organization_id=s.organization_id)
 union all
 select m.id,m.name,m.country_code,m.site,m.description,array[m.description],array[]::text[],m.checked_at::timestamptz,
 jsonb_build_object('qualification',m.qualification,'certifications',m.certifications,'delivery_status',m.delivery_status,'delivery_evidence',m.delivery_evidence,'sources',m.sources,'production_evidence',m.production_evidence,'robotics_application',m.robotics_application,'site',m.site,'points_to_confirm',m.points_to_confirm,'checked_at',m.checked_at::text,'reviewed_at',m.reviewed_at::text,'candidate',true),null::timestamptz
 from public.sourcing_manufacturers m where m.public_enabled and m.production_checked and m.qualification<>'unverified';
grant select on public.component_supplier_profiles to anon,authenticated;

create or replace function public.search_components_catalogue(criteria jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
with items as (
 select s.organization_id,s.display_name,s.country_code,s.city,s.description,s.published_at,s.public_details,p.product_id,p.name,p.category,p.description as product_description,p.specifications,
 least(
 public.robotics_technical_fit(p.specifications,criteria),
 case when coalesce(criteria->>'process','')='' then 1 when coalesce(p.specifications->>'processes','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'processes'),public.catalogue_token(criteria->>'process'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'material','')='' then 1 when coalesce(p.specifications->>'materials','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'materials'),public.catalogue_token(criteria->>'material'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'country','')='' then 1 when coalesce(p.specifications->>'manufacturing_country','')='' then 0 when criteria->>'country'='EU' and p.specifications->>'manufacturing_country'=any(array['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']) then 1 when p.specifications->>'manufacturing_country'=criteria->>'country' then 1 else -1 end,
 case when coalesce(criteria->>'quantity','')='' then 1 when coalesce(p.specifications->>'minimum_quantity','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(p.specifications->>'unit','')='' then 0 when p.specifications->>'unit'<>criteria->>'unit' then 0 when (p.specifications->>'minimum_quantity')::numeric <= nullif(criteria->>'quantity','')::numeric then 1 else -1 end
 ) as fit
 from public.component_products p join public.component_supplier_profiles s using(organization_id)
 where p.withdrawn_at is null and s.withdrawn_at is null
 and (coalesce(criteria->>'qualification','')='' or p.specifications->>'qualification'=criteria->>'qualification')
 and (coalesce(criteria->>'capacity','')='' or strpos(public.robotics_token(p.specifications->>'processes'),public.robotics_token(criteria->>'capacity'))>0)
 and (coalesce(criteria->>'certification','')='' or (p.specifications->>'certification_documented'='true' and strpos(lower(coalesce(p.specifications->>'certifications','')),lower(criteria->>'certification'))>0))
 and (coalesce(criteria->>'q','')='' or to_tsvector('simple',public.robotics_token(p.name||' '||p.description||' '||p.specifications::text||' '||coalesce((select string_agg(value||' '||substring(key from '[^_]+$'),' ') from jsonb_each_text(p.specifications) where key in ('payload_kg','reach_mm','repeatability_mm','torque_nm','speed_rpm','backlash_arcmin','voltage_v','force_n','stroke_mm','frequency_hz','range_n','tolerance_mm','length_mm')),''))) @@ plainto_tsquery('simple',public.robotics_token(left(criteria->>'q',120))) or strpos(lower(s.display_name),lower(left(criteria->>'q',120)))>0)
 and (coalesce(criteria->>'category','')='' or p.category=criteria->>'category' )
), best as (select organization_id,max(fit) as fit from items group by organization_id), grouped as (
 select i.organization_id,i.display_name,i.country_code,i.city,i.description,i.published_at,i.public_details,b.fit,max(i.specifications->>'robotics_checked_at') as information_date,
 case b.fit when 1 then 'confirmed' when 0 then 'unknown' else 'preferred_unmatched' end as match_group,
 jsonb_agg(jsonb_build_object('product_id',i.product_id,'name',i.name,'category',i.category,'description',i.product_description,'organization_id',i.organization_id,'specifications',i.specifications) order by i.name) as matched_products
 from items i join best b on i.organization_id=b.organization_id and i.fit=b.fit
 where b.fit=1 or (b.fit=0 and criteria->>'unknown'='include') or criteria->>'priority'='preferred'
 group by i.organization_id,i.display_name,i.country_code,i.city,i.description,i.published_at,i.public_details,b.fit
), paged as (select * from grouped order by fit desc,information_date desc,published_at desc,organization_id limit 12 offset (greatest(1,least(10000,coalesce((criteria->>'page')::int,1)))-1)*12)
select jsonb_build_object('suppliers',coalesce((select jsonb_agg(to_jsonb(p)-'fit') from paged p),'[]'),'count',(select count(*) from grouped),'page',greatest(1,coalesce((criteria->>'page')::int,1)),'families',coalesce((select jsonb_object_agg(category,n) from (select category,count(*) n from public.component_products group by category) f),'{}'::jsonb))
$$;

revoke all on function public.search_components_catalogue(jsonb) from public,anon,authenticated;
grant execute on function public.search_components_catalogue(jsonb) to anon,authenticated;
-- Commercial attachments use the existing private bucket and scanning processor.
create function private.manage_delivery_file(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.delivery_cases;f public.files;fid uuid:=gen_random_uuid();
begin
 perform private.lock_admin_permission('contacts.manage');
 select * into c from public.delivery_cases where id=(args->>'caseId')::uuid for update;
 if c.id is null or c.submitted_at is null then raise exception 'FORBIDDEN';end if;
 if action='reserve' then
  if c.stage in ('closed','cancelled') or length(trim(coalesce(args->>'name','')))=0 or length(args->>'name')>180 or args->>'mime' not in ('application/pdf','image/png','image/jpeg','image/webp') or coalesce(args->>'size','')!~'^[0-9]+$' or (args->>'size')::integer not between 1 and 3145728 then raise exception 'INVALID';end if;
  if (select count(*) from public.rfq_files a join public.files q on q.id=a.file_id where a.rfq_id=c.rfq_id and q.upload_state<>'removed')>=20 then raise exception 'INVALID';end if;
  insert into public.files(id,organization_id,object_path,original_name,mime_type,size_bytes,purpose,upload_state) values(fid,c.organization_id,c.organization_id||'/'||fid,args->>'name',args->>'mime',(args->>'size')::integer,'quote','reserved') returning * into f;
  insert into public.rfq_files(organization_id,rfq_id,file_id) values(c.organization_id,c.rfq_id,f.id);
  return jsonb_build_object('id',f.id,'path',f.object_path);
 end if;
 select x.* into f from public.files x join public.rfq_files a on a.file_id=x.id where a.rfq_id=c.rfq_id and x.id=(args->>'id')::uuid and x.uploaded_by=auth.uid() and x.purpose='quote' for update of x;
 if f.id is null then raise exception 'FORBIDDEN';end if;
 if action='finalize' then
  if f.upload_state<>'reserved' or not exists(select 1 from storage.objects where bucket_id='gsl-private' and name=f.object_path) then raise exception 'CONFLICT';end if;
  update public.files set upload_state='ready' where id=f.id;
 elsif action='delete' then
  update public.files set upload_state='deleting' where id=f.id;
 elsif action='removed' then
  if f.upload_state<>'deleting' or exists(select 1 from storage.objects where bucket_id='gsl-private' and name=f.object_path) then raise exception 'CONFLICT';end if;
  update public.files set upload_state='removed' where id=f.id;
 else raise exception 'INVALID';end if;
 return jsonb_build_object('id',f.id,'path',f.object_path);
end$$;
create function public.manage_delivery_file(action text,args jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.manage_delivery_file(action,args)$$;
revoke all on function private.manage_delivery_file(text,jsonb),public.manage_delivery_file(text,jsonb) from public,anon,authenticated;
grant execute on function private.manage_delivery_file(text,jsonb),public.manage_delivery_file(text,jsonb) to authenticated;
create function private.can_write_delivery_object(object_name text,removing boolean) returns boolean language sql stable security definer set search_path='' as $$
 select private.admin_has_permission('contacts.manage') and exists(select 1 from public.files f join public.rfq_files a on a.file_id=f.id join public.delivery_cases c on c.rfq_id=a.rfq_id where f.object_path=object_name and f.uploaded_by=auth.uid() and f.purpose='quote' and c.submitted_at is not null and ((removing and f.upload_state='deleting') or (not removing and f.upload_state='reserved' and c.stage not in ('closed','cancelled'))))
$$;
revoke all on function private.can_write_delivery_object(text,boolean) from public,anon,authenticated;
grant execute on function private.can_write_delivery_object(text,boolean) to authenticated;
create policy delivery_storage_upload on storage.objects for insert to authenticated with check(bucket_id='gsl-private' and private.can_write_delivery_object(name,false));
create policy delivery_storage_cleanup_read on storage.objects for select to authenticated using(bucket_id='gsl-private' and private.can_write_delivery_object(name,true));
create policy delivery_storage_remove on storage.objects for delete to authenticated using(bucket_id='gsl-private' and private.can_write_delivery_object(name,true));
-- A buyer may see scan metadata for a commercial file, but cannot download unscanned bytes.
create or replace function private.can_read_file(file uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.files f where f.id=file and f.upload_state='ready' and
 ((private.is_member(f.organization_id,array['owner','admin','procurement','sales']) and (f.purpose<>'quote' or f.uploaded_by=auth.uid() or f.scan_status='clean' or not exists(select 1 from public.rfq_files a join public.delivery_cases c on c.rfq_id=a.rfq_id where a.file_id=f.id))) or
 (f.scan_status='clean' and exists(select 1 from public.rfq_files a join public.rfqs r on r.id=a.rfq_id join public.rfq_recipients x on x.rfq_id=r.id where a.file_id=f.id and r.state<>'draft' and (a.recipient_organization_id is null or a.recipient_organization_id=x.supplier_organization_id) and private.is_member(x.supplier_organization_id,array['owner','admin','sales'])))));
$$;
create index delivery_cases_org_recent on public.delivery_cases(organization_id,updated_at desc);
create index delivery_cases_admin_recent on public.delivery_cases(updated_at desc) where submitted_at is not null;
create index delivery_events_case_recent on public.delivery_events(case_id,created_at desc);
create index delivery_shipments_case on public.delivery_shipments(case_id);
create index sourcing_manufacturers_public_family on public.sourcing_manufacturers(family,country_code,qualification) where public_enabled;
create table private.manufacturer_review_versions (manufacturer_id uuid not null references public.sourcing_manufacturers(id),revision integer not null,actor_id uuid not null references auth.users(id),data jsonb not null,created_at timestamptz not null default now(),primary key(manufacturer_id,revision));
alter table private.manufacturer_review_versions enable row level security;
revoke all on private.manufacturer_review_versions from public,anon,authenticated;
create function private.record_manufacturer_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.revision<>old.revision and new.reviewed_by is not null then insert into private.manufacturer_review_versions(manufacturer_id,revision,actor_id,data) values(new.id,new.revision,new.reviewed_by,to_jsonb(new)-'reviewed_by');end if;return new;
end$$;
revoke all on function private.record_manufacturer_review() from public,anon,authenticated;
create trigger manufacturer_review_history after update on public.sourcing_manufacturers for each row execute function private.record_manufacturer_review();
create trigger manufacturer_review_history_immutable before update or delete on private.manufacturer_review_versions for each row execute function private.admin_audit_immutable();
