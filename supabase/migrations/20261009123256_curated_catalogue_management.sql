-- Editorial manufacturer records managed by GSL owners. No supplier identity,
-- account, certification, price or commercial mandate is inferred by publication.
-- A researched family may not establish whether every reference is made to order.
alter table public.products alter column made_to_order drop not null;
create table private.curated_catalogue_companies (
 organization_id uuid primary key references public.organizations(id),
 source_id text not null unique check(source_id ~ '^F[0-9]{3}$'),
 batch_id text not null,
 revision integer not null default 1 check(revision > 0),
 published boolean not null default true,
 created_at timestamptz not null default now()
);
create table private.curated_catalogue_products (
 product_id uuid primary key references public.products(id),
 source_key text not null unique,
 revision integer not null default 1 check(revision > 0),
 published boolean not null default true,
 created_at timestamptz not null default now()
);
create table private.curated_country_guides (
 country_code text primary key check(country_code in ('TR','MA','TN','RS','MK','BA','MD','GE','AL','EG')),
 agreement jsonb not null check(jsonb_typeof(agreement)='object'),
 checked_at date not null
);
create table private.curated_catalogue_imports (
 batch_id text primary key,
 initiated_by uuid not null references auth.users(id),
 actor_kind text not null default 'server_import' check(actor_kind='server_import'),
 source_digest text not null,
 company_count integer not null,
 product_count integer not null,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create table private.curated_catalogue_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 action text not null,
 resource_id uuid not null,
 revision integer not null,
 created_at timestamptz not null default now()
);
create index curated_events_resource on private.curated_catalogue_events(resource_id,created_at desc);
create index curated_import_actor on private.curated_catalogue_imports(initiated_by);
create index curated_event_actor on private.curated_catalogue_events(actor_id);
do $$declare t text;begin
 foreach t in array array['curated_catalogue_companies','curated_catalogue_products','curated_country_guides','curated_catalogue_imports','curated_catalogue_events'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated',t);
 end loop;
end$$;
create trigger curated_events_immutable before update or delete on private.curated_catalogue_events for each row execute function private.admin_audit_immutable();

create function private.curated_public_payload_is_safe(value jsonb) returns boolean
language sql immutable set search_path='' as $$
 select value is not null
 and value::text !~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
 and value::text !~* '(mailto:|tel:|"(email|phone|telephone|referenceContact)"[[:space:]]*:)'
 and value::text !~ '\+[0-9][0-9 .()\-]{7,}[0-9]'
 and value::text !~* '\m(téléphone|telephone|phone|tél|tel|contact|standard|fax)\M[^"\\\r\n]{0,30}[0-9][0-9 .()\-]{7,}[0-9]'
 and value::text !~ '\m00[1-9][0-9 .()\-]{7,}[0-9]'
$$;
create function private.curated_sources_valid(sources jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb;
begin
 if jsonb_typeof(sources) is distinct from 'array' then return false;end if;
 if jsonb_array_length(sources) not between 1 and 60 then return false;end if;
 for item in select value from jsonb_array_elements(sources) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'url') is distinct from 'string'
   or coalesce(item->>'url','') !~ '^https?://[[:alnum:]][^[:space:]<>"@]*$'
   or length(item->>'url')>2048 or jsonb_typeof(item->'title') is distinct from 'string'
   or length(trim(coalesce(item->>'title','')))=0 or length(item->>'title')>500 then return false;end if;
  if item ? 'supports' and (jsonb_typeof(item->'supports') is distinct from 'string' or length(item->>'supports')>4000) then return false;end if;
 end loop;
 return private.curated_public_payload_is_safe(sources);
end$$;
create function private.curated_company_research_valid(research jsonb,source_id text) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; item jsonb; agreement jsonb;
begin
 if jsonb_typeof(research) is distinct from 'object' or research->>'kind' is distinct from 'gsl_research'
  or research->'schemaVersion' is distinct from '1'::jsonb or research->>'sourceId' is distinct from source_id
  or jsonb_typeof(research->'checkedAt') is distinct from 'string' or coalesce(research->>'checkedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  or coalesce(research->>'evidenceLevel','') not in ('D','R','F','H','N')
  or not private.curated_sources_valid(research->'sources') then return false;end if;
 -- A matching shape such as 2026-02-31 is not a valid documentation date.
 perform (research->>'checkedAt')::date;
 foreach k in array array['sector','family','productFamilies','processes','certifications','certificationStatus','certificationDates','europeanMarket'] loop
  if jsonb_typeof(research->k) is distinct from 'string' or length(research->>k)>12000 then return false;end if;
 end loop;
 if jsonb_typeof(research->'categories') is distinct from 'array' or jsonb_typeof(research->'regulations') is distinct from 'array' then return false;end if;
 if jsonb_array_length(research->'categories')>30 or jsonb_array_length(research->'regulations')>40
  or exists(select 1 from jsonb_array_elements(research->'categories') where jsonb_typeof(value)<>'string' or length(trim(value#>>'{}'))=0 or length(value#>>'{}')>120) then return false;end if;
 agreement:=research->'agreement';
 if jsonb_typeof(agreement) is distinct from 'object' then return false;end if;
 foreach k in array array['code','agreement','date','benefit','proof','limits'] loop
  if jsonb_typeof(agreement->k) is distinct from 'string' or length(agreement->>k)>8000 then return false;end if;
 end loop;
 if jsonb_typeof(agreement->'sources') is distinct from 'array' then return false;end if;
 if jsonb_array_length(agreement->'sources')>30 or (jsonb_array_length(agreement->'sources')>0 and not private.curated_sources_valid(agreement->'sources')) then return false;end if;
 for item in select value from jsonb_array_elements(research->'regulations') loop
  if jsonb_typeof(item) is distinct from 'object' then return false;end if;
  foreach k in array array['id','type','title','scope','requirements','limits'] loop
   if jsonb_typeof(item->k) is distinct from 'string' or length(item->>k)>12000 then return false;end if;
  end loop;
  if length(trim(item->>'id'))=0 or length(item->>'id')>120 or length(trim(item->>'title'))=0 or length(item->>'title')>1500
   or jsonb_typeof(item->'sources') is distinct from 'array' then return false;end if;
  if jsonb_array_length(item->'sources')>30 or (jsonb_array_length(item->'sources')>0 and not private.curated_sources_valid(item->'sources')) then return false;end if;
 end loop;
 return private.curated_public_payload_is_safe(research);
exception when others then return false;
end$$;
create function private.curated_product_research_valid(research jsonb,source_key text,company_source text) returns boolean
language plpgsql immutable set search_path='' as $$
declare commercial jsonb; k text; minimum numeric; maximum numeric; item jsonb;
 quantity numeric; price numeric; previous_quantity numeric; tier_minimum numeric; tier_maximum numeric; minimum_quantity numeric; minimum_matches boolean:=false;
begin
 if jsonb_typeof(research) is distinct from 'object' or research->>'kind' is distinct from 'gsl_research'
  or research->'schemaVersion' is distinct from '1'::jsonb or research->>'sourceId' is distinct from source_key
  or research->>'companySourceId' is distinct from company_source
  or jsonb_typeof(research->'checkedAt') is distinct from 'string' or coalesce(research->>'checkedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  or not private.curated_sources_valid(research->'sources') then return false;end if;
 perform (research->>'checkedAt')::date;
 if jsonb_typeof(research->'specifications') is distinct from 'object'
  or jsonb_typeof(research->'materials') is distinct from 'array'
  or jsonb_typeof(research->'applications') is distinct from 'array' then return false;end if;
 if (select count(*) from jsonb_each(research->'specifications'))>100
  or exists(select 1 from jsonb_each(research->'specifications') where jsonb_typeof(value)<>'string' or length(value#>>'{}')>6000
   or length(key) not between 1 and 200 or key<>trim(key) or key=any(array['__proto__','constructor','prototype','research_data'])
   or key ~* '(^|[_[:space:]-])(email|e-mail|phone|telephone|téléphone|fax|contact)($|[_[:space:]-])') then return false;end if;
 foreach k in array array['materials','applications'] loop
  if jsonb_array_length(research->k)>80
   or exists(select 1 from jsonb_array_elements(research->k) where jsonb_typeof(value)<>'string' or length(trim(value#>>'{}'))=0 or length(value#>>'{}')>500) then return false;end if;
 end loop;
 if not research ? 'customization' or (research->'customization'<>'null'::jsonb and
  (jsonb_typeof(research->'customization') is distinct from 'string' or length(trim(research->>'customization'))=0 or length(research->>'customization')>4000)) then return false;end if;
 if research ? 'scopeNote' and (jsonb_typeof(research->'scopeNote') is distinct from 'string' or length(research->>'scopeNote')>6000) then return false;end if;
 commercial:=research->'commercial';
 if jsonb_typeof(commercial) is distinct from 'object' or not commercial ?& array['price_min','price_max','currency','unit','moq','lead_time','terms','status'] then return false;end if;
 foreach k in array array['price_min','price_max','moq','minimum_price_quantity'] loop
  if commercial ? k and commercial->k<>'null'::jsonb and
   (jsonb_typeof(commercial->k) is distinct from 'number' or (commercial->>k)::numeric<=0 or (commercial->>k)::numeric>1000000000000) then return false;end if;
 end loop;
 foreach k in array array['currency','unit','lead_time','terms','availability'] loop
  if commercial ? k and commercial->k<>'null'::jsonb and
   (jsonb_typeof(commercial->k) is distinct from 'string' or length(trim(commercial->>k))=0
    or length(commercial->>k)>case k when 'currency' then 3 when 'unit' then 200 when 'terms' then 8000 else 2000 end) then return false;end if;
 end loop;
 if commercial->>'currency' is not null and commercial->>'currency' !~ '^[A-Z]{3}$' then return false;end if;
 if jsonb_typeof(commercial->'status') is distinct from 'string' or length(trim(commercial->>'status'))=0 or length(commercial->>'status')>1000 then return false;end if;
 minimum:=(commercial->>'price_min')::numeric;maximum:=(commercial->>'price_max')::numeric;
 if minimum is not null or maximum is not null then
  if coalesce(commercial->>'currency','') !~ '^[A-Z]{3}$' or length(trim(coalesce(commercial->>'unit','')))=0 then return false;end if;
  if minimum is not null and maximum is not null and minimum>maximum then return false;end if;
 end if;
 if commercial->>'moq' is not null and (coalesce(commercial->>'moq','') !~ '^[0-9]+([.][0-9]+)?$' or (commercial->>'moq')::numeric<=0 or length(trim(coalesce(commercial->>'unit','')))=0) then return false;end if;
 if commercial ? 'price_tiers' then
  if jsonb_typeof(commercial->'price_tiers') is distinct from 'array' then return false;end if;
  if jsonb_array_length(commercial->'price_tiers')>50 then return false;end if;
  if jsonb_array_length(commercial->'price_tiers')>0 then
   if minimum is null or maximum is null or commercial->>'currency' is null or commercial->>'unit' is null then return false;end if;
   minimum_quantity:=(commercial->>'minimum_price_quantity')::numeric;
   for item in select value from jsonb_array_elements(commercial->'price_tiers') loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'quantity') is distinct from 'number' or jsonb_typeof(item->'price') is distinct from 'number'
     or exists(select 1 from jsonb_object_keys(item) key where key not in ('quantity','price')) then return false;end if;
    quantity:=(item->>'quantity')::numeric;price:=(item->>'price')::numeric;
    if quantity<=0 or price<=0 or quantity>1000000000000 or price>1000000000000 or (previous_quantity is not null and quantity<=previous_quantity) then return false;end if;
    previous_quantity:=quantity;tier_minimum:=least(tier_minimum,price);tier_maximum:=greatest(tier_maximum,price);
    if price=minimum and quantity=minimum_quantity then minimum_matches:=true;end if;
   end loop;
   if tier_minimum<>minimum or tier_maximum<>maximum or not minimum_matches then return false;end if;
  end if;
 end if;
 return private.curated_public_payload_is_safe(research);
exception when others then return false;
end$$;

-- Only trusted commands call this reconciler. A hidden company also hides all
-- products while preserving the owner's individual publication choices.
create function private.refresh_curated_publication(organization uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.published_supplier_profiles s set withdrawn_at=case when c.published then null else coalesce(s.withdrawn_at,now()) end
 from private.curated_catalogue_companies c where c.organization_id=organization and s.organization_id=c.organization_id;
 update public.published_products p set withdrawn_at=case when c.published and cp.published then null else coalesce(p.withdrawn_at,now()) end
 from private.curated_catalogue_companies c,private.curated_catalogue_products cp
 where c.organization_id=organization and p.organization_id=c.organization_id and cp.product_id=p.product_id;
end$$;

create function private.admin_catalogue_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin_permission('access.manage');
 return jsonb_build_object('canManage',true,
 'companies',(select coalesce(jsonb_agg(to_jsonb(row) order by row.name),'[]') from (
  select c.organization_id id,s.display_name name,s.country_code country,s.city,s.description,s.processes,s.materials,o.website,s.public_details details,c.revision,c.published
  from private.curated_catalogue_companies c join public.organizations o on o.id=c.organization_id join public.published_supplier_profiles s on s.organization_id=c.organization_id)row),
 'products',(select coalesce(jsonb_agg(to_jsonb(row) order by row.name),'[]') from (
  select cp.product_id id,p.organization_id "companyId",p.name,p.model_reference reference,p.category,p.description,p.specifications,cp.revision,cp.published
  from private.curated_catalogue_products cp join public.products p on p.id=cp.product_id)row),
 'recipients',(select coalesce(jsonb_agg(jsonb_build_object('userId',u.id,'name',coalesce(nullif(p.display_name,''),u.email),'email',u.email) order by u.id),'[]')
  from private.platform_admins a join auth.users u on u.id=a.user_id left join public.profiles p on p.user_id=u.id where a.role='owner' and private.admin_user_is_active(u.id)),
 'notificationStatus',jsonb_build_object('pending',(select count(*) from public.notification_outbox where state in ('pending','processing')),'failed',(select count(*) from public.notification_outbox where state='failed')));
end$$;
create function public.admin_catalogue_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$select private.admin_catalogue_snapshot()$$;

create function private.admin_catalogue_mutate(input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare action text; target uuid; organization uuid; expected integer;
 company private.curated_catalogue_companies; product private.curated_catalogue_products;
 research jsonb; specification jsonb; country_agreement jsonb; supplier public.published_supplier_profiles;
 saved_revision integer; publication_revision integer; is_company boolean; unit text; minimum text;
begin
 perform private.lock_admin_permission('access.manage');
 if jsonb_typeof(input) is distinct from 'object' or length(input::text)>200000 then raise exception 'INVALID';end if;
 action:=input->>'action';
 if action is null or action not in ('save_company','save_product','set_company_visibility','set_product_visibility')
  or coalesce(input->>'revision','') !~ '^[1-9][0-9]{0,8}$' then raise exception 'INVALID';end if;
 target:=(input->>'id')::uuid;expected:=(input->>'revision')::integer;
 is_company:=action in ('save_company','set_company_visibility');
 if is_company then organization:=target;else
  select p.organization_id into organization from public.products p join private.curated_catalogue_products cp on cp.product_id=p.id where p.id=target;
 end if;
 if organization is null then raise exception 'NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended('curated-catalogue:'||organization::text,47));
 select * into company from private.curated_catalogue_companies where organization_id=organization for update;
 if company.organization_id is null then raise exception 'NOT_FOUND';end if;
 if is_company then
  if company.revision<>expected then raise exception 'CONFLICT';end if;
 else
  select * into product from private.curated_catalogue_products where product_id=target for update;
  if product.product_id is null then raise exception 'NOT_FOUND';end if;
  if product.revision<>expected then raise exception 'CONFLICT';end if;
 end if;

 if action='save_company' then
  if length(trim(coalesce(input->>'name',''))) not between 2 and 250
   or length(coalesce(input->>'description',''))>20000 or length(coalesce(input->>'city',''))>250
   or jsonb_typeof(input->'processes') is distinct from 'array' or jsonb_typeof(input->'materials') is distinct from 'array'
   or jsonb_array_length(input->'processes')>100 or jsonb_array_length(input->'materials')>100
   or not private.curated_company_research_valid(input->'research',company.source_id)
   or not private.curated_public_payload_is_safe(input) then raise exception 'INVALID';end if;
  if exists(select 1 from jsonb_array_elements(input->'processes') where jsonb_typeof(value)<>'string')
   or exists(select 1 from jsonb_array_elements(input->'materials') where jsonb_typeof(value)<>'string') then raise exception 'INVALID';end if;
  if nullif(input->>'website','') is not null and (input->>'website' !~ '^https?://[[:alnum:]][^[:space:]<>"@]*$') then raise exception 'INVALID';end if;
  select agreement into country_agreement from private.curated_country_guides where country_code=input->>'country';
  if country_agreement is null then raise exception 'INVALID';end if;
  research:=jsonb_set(input->'research','{agreement}',country_agreement);
  select * into supplier from public.published_supplier_profiles where organization_id=organization;
  update public.organizations set legal_name=trim(input->>'name'),trading_name=trim(input->>'name'),country_code=input->>'country',
   description=input->>'description',website=nullif(input->>'website','') where id=organization returning revision into publication_revision;
  update public.published_supplier_profiles set display_name=trim(input->>'name'),country_code=input->>'country',city=input->>'city',description=input->>'description',
   processes=array(select jsonb_array_elements_text(input->'processes')),materials=array(select jsonb_array_elements_text(input->'materials')),
   source_revision=publication_revision,
   public_details=(coalesce(supplier.public_details,'{}')-'referenceContact')||jsonb_build_object('verification','sourced','activity',research->>'sector','website',nullif(input->>'website',''),'research',research)
   where organization_id=organization;
  update private.curated_catalogue_companies set revision=revision+1 where organization_id=organization returning revision into saved_revision;
 elsif action='save_product' then
  specification:=input->'specifications';
  if length(trim(coalesce(input->>'name',''))) not between 2 and 250
   or length(coalesce(input->>'description',''))>20000 or length(trim(coalesce(input->>'reference',''))) not between 1 and 250
   or coalesce(input->>'category','') !~ '^[a-z][a-z0-9-]{0,79}$'
   or jsonb_typeof(specification) is distinct from 'object'
   or not private.curated_public_payload_is_safe(input) then raise exception 'INVALID';end if;
  if exists(select 1 from jsonb_each(specification) where jsonb_typeof(value)<>'string') then raise exception 'INVALID';end if;
  begin research:=(specification->>'research_data')::jsonb;exception when others then raise exception 'INVALID';end;
  if not private.curated_product_research_valid(research,product.source_key,company.source_id) then raise exception 'INVALID';end if;
  unit:=case research#>>'{commercial,unit}' when 'pièce' then 'pcs' when 'pièces' then 'pcs' when 'carte' then 'pcs' when 'pcs' then 'pcs' when 'kg' then 'kg' when 'm' then 'm' when 'mètre' then 'm' when 'm2' then 'm2' when 'set' then 'set' else '' end;
  minimum:=case when unit<>'' then coalesce(research#>>'{commercial,moq}','') else '' end;
  specification:=specification||jsonb_build_object('research_data',research::text,'minimum_quantity',minimum,'unit',unit,'lead_time',coalesce(research#>>'{commercial,lead_time}',''),
   'verification','sourced','compliance','not_assessed','materials',(select coalesce(string_agg(value,', '),'') from jsonb_array_elements_text(research->'materials')));
  update public.products set name=trim(input->>'name'),model_reference=trim(input->>'reference'),category=input->>'category',description=input->>'description',specifications=specification
   where id=target returning revision into publication_revision;
  update public.published_products set name=trim(input->>'name'),category=input->>'category',description=input->>'description',specifications=specification,source_revision=publication_revision where product_id=target;
  update private.curated_catalogue_products set revision=revision+1 where product_id=target returning revision into saved_revision;
 elsif action='set_company_visibility' then
  if jsonb_typeof(input->'published') is distinct from 'boolean' then raise exception 'INVALID';end if;
  update private.curated_catalogue_companies set published=(input->>'published')::boolean,revision=revision+1 where organization_id=organization returning revision into saved_revision;
 elsif action='set_product_visibility' then
  if jsonb_typeof(input->'published') is distinct from 'boolean' then raise exception 'INVALID';end if;
  update private.curated_catalogue_products set published=(input->>'published')::boolean,revision=revision+1 where product_id=target returning revision into saved_revision;
 end if;
 perform private.refresh_curated_publication(organization);
 insert into private.curated_catalogue_events(actor_id,action,resource_id,revision) values(auth.uid(),action,target,saved_revision);
 return jsonb_build_object('saved',true,'revision',saved_revision);
end$$;
create function public.admin_catalogue_mutate(input jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.admin_catalogue_mutate(input)$$;

revoke all on function private.curated_public_payload_is_safe(jsonb),private.curated_sources_valid(jsonb),private.curated_company_research_valid(jsonb,text),private.curated_product_research_valid(jsonb,text,text),private.refresh_curated_publication(uuid) from public,anon,authenticated;
revoke all on function private.admin_catalogue_snapshot(),public.admin_catalogue_snapshot(),private.admin_catalogue_mutate(jsonb),public.admin_catalogue_mutate(jsonb) from public,anon;
grant execute on function private.admin_catalogue_snapshot(),public.admin_catalogue_snapshot(),private.admin_catalogue_mutate(jsonb),public.admin_catalogue_mutate(jsonb) to authenticated;

-- Keep the broad navigation categories useful alongside precise industrial categories.
create function public.catalogue_category_group(category text) returns text language sql immutable security invoker set search_path='' as $$
 select case
 when category in ('usinage-precision','tolerie-soudage','fonderie-forge','aluminium-extrusion','roulements-transmission','ressorts-fixations') then 'metal'
 when category in ('cables-electriques','faisceaux-cablage','electronique-capteurs','energie-transformateurs','automatismes-appareillage') then 'electricite'
 when category in ('pompes-hydraulique','manutention-industrielle') then 'machines'
 when category in ('moules-injection','elastomeres-etancheite') then 'plasturgie'
 when category='acier-construction' then 'construction'
 else category end
$$;
revoke all on function public.catalogue_category_group(text) from public;
grant execute on function public.catalogue_category_group(text) to anon,authenticated;

create or replace function public.search_catalogue(criteria jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
with items as (
 select s.organization_id,s.display_name,s.country_code,s.city,s.description,s.published_at,s.public_details,p.product_id,p.name,p.category,p.description as product_description,p.specifications,
 least(
 case when coalesce(criteria->>'process','')='' then 1 when coalesce(p.specifications->>'processes','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'processes'),public.catalogue_token(criteria->>'process'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'material','')='' then 1 when coalesce(p.specifications->>'materials','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'materials'),public.catalogue_token(criteria->>'material'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'country','')='' then 1 when coalesce(p.specifications->>'manufacturing_country','')='' then 0 when criteria->>'country'='EU' and p.specifications->>'manufacturing_country'=any(array['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']) then 1 when p.specifications->>'manufacturing_country'=criteria->>'country' then 1 else -1 end,
 case when coalesce(criteria->>'quantity','')='' then 1 when coalesce(p.specifications->>'minimum_quantity','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(p.specifications->>'unit','')='' then 0 when p.specifications->>'unit'<>criteria->>'unit' then 0 when (p.specifications->>'minimum_quantity')::numeric <= nullif(criteria->>'quantity','')::numeric then 1 else -1 end
 ) as fit
 from public.published_products p join public.published_supplier_profiles s using(organization_id)
 where p.withdrawn_at is null and s.withdrawn_at is null
 and (coalesce(criteria->>'q','')='' or to_tsvector('simple',public.catalogue_token(p.name||' '||p.description||' '||p.specifications::text)) @@ plainto_tsquery('simple',public.catalogue_token(left(criteria->>'q',120))) or strpos(lower(s.display_name),lower(left(criteria->>'q',120)))>0)
 and (coalesce(criteria->>'category','')='' or p.category=criteria->>'category' or public.catalogue_category_group(p.category)=criteria->>'category')
), best as (select organization_id,max(fit) as fit from items group by organization_id), grouped as (
 select i.organization_id,i.display_name,i.country_code,i.city,i.description,i.published_at,i.public_details,b.fit,
 case b.fit when 1 then 'confirmed' when 0 then 'unknown' else 'preferred_unmatched' end as match_group,
 jsonb_agg(jsonb_build_object('product_id',i.product_id,'name',i.name,'category',i.category,'description',i.product_description,'organization_id',i.organization_id,'specifications',i.specifications) order by i.name) as matched_products
 from items i join best b on i.organization_id=b.organization_id and i.fit=b.fit
 where b.fit=1 or (b.fit=0 and criteria->>'unknown'='include') or criteria->>'priority'='preferred'
 group by i.organization_id,i.display_name,i.country_code,i.city,i.description,i.published_at,i.public_details,b.fit
), paged as (select * from grouped order by fit desc,published_at desc,organization_id limit 12 offset (greatest(1,least(10000,coalesce((criteria->>'page')::int,1)))-1)*12)
select jsonb_build_object('suppliers',coalesce((select jsonb_agg(to_jsonb(p)-'fit') from paged p),'[]'),'count',(select count(*) from grouped),'page',greatest(1,coalesce((criteria->>'page')::int,1)))
$$;
