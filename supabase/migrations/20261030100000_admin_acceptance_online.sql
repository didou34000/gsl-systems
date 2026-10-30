-- Administrator acceptance puts the item online (owner rule 2026-10-30).
-- A verified company is listed among manufacturers even without an admitted offer;
-- a product verified in one click appears in the catalogue as its supplier published it.
create or replace view public.component_products with(security_invoker=true) as
 select p.product_id,p.organization_id,p.source_revision,p.name,
 case p.category when 'mecanique-cablage' then 'pieces-mecaniques' else p.category end as category,p.description,p.published_at,p.withdrawn_at,
 p.specifications||jsonb_build_object('qualification','explicit','delivery_status','on_review') as specifications
 from public.robotics_products p where p.category<>'robots-plateformes'
 union all
 select m.id,m.id,m.revision,m.description,m.family,m.robotics_application,m.checked_at::timestamptz,null::timestamptz,
 jsonb_build_object('candidate_id',m.id::text,'manufacturing_country',m.country_code,'robotics_family',m.family,'qualification',m.qualification,'robotics_site',m.site,'robotics_offer',m.description,'robotics_checked_at',m.checked_at::text,'robotics_sources',m.sources::text,'production_evidence',m.production_evidence,'points_to_confirm',m.points_to_confirm,'delivery_status',m.delivery_status,'delivery_evidence',m.delivery_evidence,'processes',m.description,'certifications',coalesce((select string_agg(x->>'name',' · ') from jsonb_array_elements(m.certifications) x where nullif(x->>'validUntil','') is not null and (x->>'validUntil')::date>=current_date),''),'certification_documented',case when exists(select 1 from jsonb_array_elements(m.certifications) x where nullif(x->>'validUntil','') is not null and (x->>'validUntil')::date>=current_date) then 'true' else 'false' end)
 from public.sourcing_manufacturers m where m.public_enabled and m.production_checked and m.qualification<>'unverified'
 union all
 -- One-click administrator acceptance: a verified product of a published company goes online as it was published.
 select p.product_id,p.organization_id,p.source_revision,p.name,
 case p.category when 'mecanique-cablage' then 'pieces-mecaniques' else p.category end,p.description,p.published_at,p.withdrawn_at,
 p.specifications||jsonb_build_object('qualification','explicit')
 from public.published_products p join public.published_supplier_profiles s using(organization_id)
 where p.specifications->>'verification'='verified' and p.withdrawn_at is null and s.withdrawn_at is null and p.category<>'robots-plateformes'
 and not exists(select 1 from public.robotics_products r where r.product_id=p.product_id);

create or replace view public.component_supplier_profiles with(security_invoker=true) as
 select s.organization_id,s.display_name,s.country_code,s.city,s.description,s.processes,s.materials,s.published_at,s.public_details,s.withdrawn_at
 from public.published_supplier_profiles s where exists(select 1 from public.component_products p where p.organization_id=s.organization_id)
 or s.public_details->>'verification'='verified'
 union all
 select m.id,m.name,m.country_code,m.site,m.description,array[m.description],array[]::text[],m.checked_at::timestamptz,
 jsonb_build_object('qualification',m.qualification,'certifications',m.certifications,'delivery_status',m.delivery_status,'delivery_evidence',m.delivery_evidence,'sources',m.sources,'production_evidence',m.production_evidence,'robotics_application',m.robotics_application,'site',m.site,'points_to_confirm',m.points_to_confirm,'checked_at',m.checked_at::text,'reviewed_at',m.reviewed_at::text,'candidate',true),null::timestamptz
 from public.sourcing_manufacturers m where m.public_enabled and m.production_checked and m.qualification<>'unverified';

create or replace function public.search_components_catalogue(criteria jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
with items as (
 select s.organization_id,s.display_name,s.country_code,s.city,s.description,s.published_at,s.public_details,p.product_id,p.name,p.category,p.description as product_description,p.specifications,
 least(
 public.robotics_technical_fit(p.specifications,criteria),
 case when coalesce(criteria->>'process','')='' then 1 when coalesce(p.specifications->>'processes','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'processes'),public.catalogue_token(criteria->>'process'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'material','')='' then 1 when coalesce(p.specifications->>'materials','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'materials'),public.catalogue_token(criteria->>'material'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'country','')='' then 1 when coalesce(p.specifications->>'manufacturing_country',case when p.product_id is null then s.country_code end,'')='' then 0 when criteria->>'country'='EU' and coalesce(p.specifications->>'manufacturing_country',s.country_code)=any(array['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']) then 1 when coalesce(p.specifications->>'manufacturing_country',s.country_code)=criteria->>'country' then 1 else -1 end,
 case when coalesce(criteria->>'quantity','')='' then 1 when coalesce(p.specifications->>'minimum_quantity','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(p.specifications->>'unit','')='' then 0 when p.specifications->>'unit'<>criteria->>'unit' then 0 when (p.specifications->>'minimum_quantity')::numeric <= nullif(criteria->>'quantity','')::numeric then 1 else -1 end
 ) as fit
 -- A verified company is listed even before it has an offer online; product filters then exclude it.
 from public.component_supplier_profiles s left join public.component_products p on p.organization_id=s.organization_id and p.withdrawn_at is null
 where s.withdrawn_at is null
 and (coalesce(criteria->>'qualification','')='' or p.specifications->>'qualification'=criteria->>'qualification')
 and (coalesce(criteria->>'capacity','')='' or strpos(public.robotics_token(p.specifications->>'processes'),public.robotics_token(criteria->>'capacity'))>0)
 and (coalesce(criteria->>'certification','')='' or (p.specifications->>'certification_documented'='true' and strpos(lower(coalesce(p.specifications->>'certifications','')),lower(criteria->>'certification'))>0))
 and (coalesce(criteria->>'q','')='' or to_tsvector('simple',public.robotics_token(p.name||' '||p.description||' '||p.specifications::text||' '||coalesce((select string_agg(value||' '||substring(key from '[^_]+$'),' ') from jsonb_each_text(p.specifications) where key in ('payload_kg','reach_mm','repeatability_mm','torque_nm','speed_rpm','backlash_arcmin','voltage_v','force_n','stroke_mm','frequency_hz','range_n','tolerance_mm','length_mm')),''))) @@ plainto_tsquery('simple',public.robotics_token(left(criteria->>'q',120))) or strpos(lower(s.display_name),lower(left(criteria->>'q',120)))>0)
 and (coalesce(criteria->>'category','')='' or p.category=criteria->>'category' )
), best as (select organization_id,max(fit) as fit from items group by organization_id), grouped as (
 select i.organization_id,i.display_name,i.country_code,i.city,i.description,i.published_at,i.public_details,b.fit,max(i.specifications->>'robotics_checked_at') as information_date,
 case b.fit when 1 then 'confirmed' when 0 then 'unknown' else 'preferred_unmatched' end as match_group,
 coalesce(jsonb_agg(jsonb_build_object('product_id',i.product_id,'name',i.name,'category',i.category,'description',i.product_description,'organization_id',i.organization_id,'specifications',i.specifications) order by i.name) filter (where i.product_id is not null),'[]') as matched_products
 from items i join best b on i.organization_id=b.organization_id and i.fit=b.fit
 where b.fit=1 or (b.fit=0 and criteria->>'unknown'='include') or criteria->>'priority'='preferred'
 group by i.organization_id,i.display_name,i.country_code,i.city,i.description,i.published_at,i.public_details,b.fit
), paged as (select * from grouped order by fit desc,information_date desc,published_at desc,organization_id limit 12 offset (greatest(1,least(10000,coalesce((criteria->>'page')::int,1)))-1)*12)
select jsonb_build_object('suppliers',coalesce((select jsonb_agg(to_jsonb(p)-'fit') from paged p),'[]'),'count',(select count(*) from grouped),'page',greatest(1,coalesce((criteria->>'page')::int,1)),'families',coalesce((select jsonb_object_agg(category,n) from (select category,count(*) n from public.component_products group by category) f),'{}'::jsonb))
$$;


create or replace function private.admin_verification(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if args-'id'='{}'::jsonb then
   -- One-click acceptance: the product goes online as its supplier published it.
   insert into private.admin_verifications(kind,entity_id,decided_by) values('product',target,auth.uid()) on conflict(kind,entity_id) do update set decided_by=excluded.decided_by,decided_at=now();
   update public.published_products set specifications=specifications where product_id=target;
  else
  if coalesce(args->>'family','') not in ('actionnement-transmission','transmissions-guidages','prehension','capteurs-vision','commande-electronique','cables-connecteurs','energie-batteries','pieces-mecaniques')
  or length(trim(coalesce(args->>'site',''))) not between 3 and 500 or length(trim(coalesce(args->>'roboticsOffer',''))) not between 21 and 4000
  or private.curated_sources_valid(args->'sources') is distinct from true
  or private.curated_public_payload_is_safe(jsonb_build_object('site',args->'site','offer',args->'roboticsOffer','sources',args->'sources')) is distinct from true then raise exception 'INVALID';end if;
  if not public.gsl_sourcing_country(product.specifications->>'manufacturing_country') then raise exception 'COUNTRY_OUTSIDE_SCOPE';end if;
  insert into public.robotics_admissions(product_id,product_revision,company_revision,family,production_country,production_site,robotics_offer,sources,checked_at,technical,reviewed_by)
   values(target,product.source_revision,company.source_revision,args->>'family',product.specifications->>'manufacturing_country',trim(args->>'site'),trim(args->>'roboticsOffer'),args->'sources',current_date,'{}',auth.uid())
   on conflict(product_id) do update set product_revision=excluded.product_revision,company_revision=excluded.company_revision,family=excluded.family,production_country=excluded.production_country,production_site=excluded.production_site,robotics_offer=excluded.robotics_offer,sources=excluded.sources,checked_at=excluded.checked_at,technical=excluded.technical,reviewed_by=excluded.reviewed_by;
  end if;
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
