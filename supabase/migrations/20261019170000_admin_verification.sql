-- Explicit administrator verification for published companies and products.
-- Until now "verification" was written as 'unverified' by every publication RPC and nothing could change it.
-- Decisions live in a private table so a supplier republication keeps the administrator's decision,
-- and a supplier can never write 'verified' itself. No existing row is deleted or reclassified.
create table private.admin_verifications (
 kind text not null check(kind in ('company','product')),
 entity_id uuid not null,
 decided_by uuid not null references auth.users(id),
 decided_at timestamptz not null default now(),
 primary key(kind,entity_id)
);
alter table private.admin_verifications enable row level security;
revoke all on private.admin_verifications from public,anon,authenticated;

create function private.apply_admin_verification() returns trigger language plpgsql security definer set search_path='' as $$
declare verified boolean;current text;
begin
 if tg_table_name='published_supplier_profiles' then
  verified=exists(select 1 from private.admin_verifications where kind='company' and entity_id=new.organization_id);
  current=coalesce(new.public_details->>'verification','unverified');
  new.public_details=coalesce(new.public_details,'{}')||jsonb_build_object('verification',case when verified then 'verified' when current='verified' then 'unverified' else current end);
 else
  verified=exists(select 1 from private.admin_verifications where kind='product' and entity_id=new.product_id);
  current=coalesce(new.specifications->>'verification','unverified');
  new.specifications=coalesce(new.specifications,'{}')||jsonb_build_object('verification',case when verified then 'verified' when current='verified' then 'unverified' else current end);
 end if;
 return new;
end $$;
revoke all on function private.apply_admin_verification() from public,anon,authenticated;
create trigger apply_admin_verification before insert or update on public.published_supplier_profiles
 for each row execute function private.apply_admin_verification();
create trigger apply_admin_verification before insert or update on public.published_products
 for each row execute function private.apply_admin_verification();

-- An administrator admission to the catalogue (queue approval or direct verification) verifies the product.
create function private.verify_admitted_product() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.admin_verifications(kind,entity_id,decided_by) values('product',new.product_id,new.reviewed_by)
  on conflict(kind,entity_id) do update set decided_by=excluded.decided_by,decided_at=now();
 update public.published_products set specifications=specifications where product_id=new.product_id;
 return new;
end $$;
revoke all on function private.verify_admitted_product() from public,anon,authenticated;
create trigger verify_admitted_product after insert or update on public.robotics_admissions
 for each row execute function private.verify_admitted_product();

create function private.admin_verification(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;company public.published_supplier_profiles;product public.published_products;
begin
 perform private.lock_admin_permission(null);
 if not private.is_product_admin() then raise exception 'PERMISSION_REQUIRED';end if;
 if args is null or jsonb_typeof(args) is distinct from 'object' or coalesce(args->>'id','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'INVALID';end if;
 target=(args->>'id')::uuid;
 if action in ('company.verify','company.unverify') then
  select * into company from public.published_supplier_profiles where organization_id=target for update;
  if company.organization_id is null then raise exception 'NOT_FOUND';end if;
  if action='company.verify' then
   insert into private.admin_verifications(kind,entity_id,decided_by) values('company',target,auth.uid()) on conflict(kind,entity_id) do update set decided_by=excluded.decided_by,decided_at=now();
  else
   delete from private.admin_verifications where kind='company' and entity_id=target;
  end if;
  update public.published_supplier_profiles set public_details=public_details where organization_id=target;
 elsif action='product.verify' then
  select * into product from public.published_products where product_id=target for update;
  if product.product_id is null or product.withdrawn_at is not null then raise exception 'NOT_FOUND';end if;
  select * into company from public.published_supplier_profiles where organization_id=product.organization_id and withdrawn_at is null for share;
  if company.organization_id is null then raise exception 'COMPANY_REQUIRED';end if;
  if coalesce(args->>'family','') not in ('actionnement-transmission','transmissions-guidages','prehension','capteurs-vision','commande-electronique','cables-connecteurs','energie-batteries','pieces-mecaniques')
  or length(trim(coalesce(args->>'site',''))) not between 3 and 500 or length(trim(coalesce(args->>'roboticsOffer',''))) not between 21 and 4000
  or private.curated_sources_valid(args->'sources') is distinct from true
  or private.curated_public_payload_is_safe(jsonb_build_object('site',args->'site','offer',args->'roboticsOffer','sources',args->'sources')) is distinct from true then raise exception 'INVALID';end if;
  if not public.gsl_sourcing_country(product.specifications->>'manufacturing_country') then raise exception 'COUNTRY_OUTSIDE_SCOPE';end if;
  insert into public.robotics_admissions(product_id,product_revision,company_revision,family,production_country,production_site,robotics_offer,sources,checked_at,technical,reviewed_by)
   values(target,product.source_revision,company.source_revision,args->>'family',product.specifications->>'manufacturing_country',trim(args->>'site'),trim(args->>'roboticsOffer'),args->'sources',current_date,'{}',auth.uid())
   on conflict(product_id) do update set product_revision=excluded.product_revision,company_revision=excluded.company_revision,family=excluded.family,production_country=excluded.production_country,production_site=excluded.production_site,robotics_offer=excluded.robotics_offer,sources=excluded.sources,checked_at=excluded.checked_at,technical=excluded.technical,reviewed_by=excluded.reviewed_by;
 elsif action='product.unverify' then
  select * into product from public.published_products where product_id=target for update;
  if product.product_id is null then raise exception 'NOT_FOUND';end if;
  delete from public.robotics_admissions where product_id=target;
  delete from private.admin_verifications where kind='product' and entity_id=target;
  update public.published_products set specifications=specifications where product_id=target;
 else raise exception 'INVALID';
 end if;
 insert into private.admin_events(actor_id,action,resource_id) values(auth.uid(),replace(action,'.','_'),target);
 return jsonb_build_object('saved',true,'id',target);
end $$;
create function public.admin_verification(action text,args jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.admin_verification(action,args)$$;
revoke all on function private.admin_verification(text,jsonb),public.admin_verification(text,jsonb) from public,anon;
grant execute on function private.admin_verification(text,jsonb),public.admin_verification(text,jsonb) to authenticated;

