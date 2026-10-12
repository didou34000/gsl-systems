-- Admission is a reviewed editorial decision, separate from publication or trade agreements.
-- No existing product or company is deleted, reclassified or automatically admitted.
create table public.robotics_admissions (
 product_id uuid primary key references public.published_products(product_id),
 product_revision integer not null,
 company_revision integer not null,
 family text not null check(family in ('robots-plateformes','actionnement-transmission','prehension','capteurs-vision','commande-electronique','mecanique-cablage')),
 production_country text not null check(production_country in ('TR','MA','TN','RS','MK','BA','MD','GE','AL','EG')),
 production_site text not null check(length(trim(production_site))>2),
 robotics_offer text not null check(length(trim(robotics_offer))>20),
 sources jsonb not null check(private.curated_sources_valid(sources)),
 checked_at date not null check(checked_at <= current_date),
 technical jsonb not null default '{}' check(jsonb_typeof(technical)='object'),
 reviewed_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.robotics_admissions enable row level security;
revoke all on public.robotics_admissions from public,anon,authenticated;
grant select(product_id,product_revision,company_revision,family,production_country,production_site,robotics_offer,sources,checked_at,technical) on public.robotics_admissions to anon,authenticated;
create policy robotics_admissions_read on public.robotics_admissions for select to anon,authenticated using (
 exists(select 1 from public.published_products p join public.published_supplier_profiles s using(organization_id)
 where p.product_id=robotics_admissions.product_id and p.source_revision=product_revision and s.source_revision=company_revision
 and p.withdrawn_at is null and s.withdrawn_at is null)
);
-- Reviewed canonical values are strings; numeric metric units are defined in lib/robotics.ts.
create view public.robotics_products with(security_invoker=true) as
 select p.product_id,p.organization_id,p.source_revision,p.name,a.family as category,p.description,p.published_at,p.withdrawn_at,
 p.specifications || a.technical || jsonb_build_object('manufacturing_country',a.production_country,'robotics_family',a.family,'robotics_site',a.production_site,'robotics_checked_at',a.checked_at::text,'robotics_offer',a.robotics_offer,'robotics_sources',a.sources::text) as specifications
 from public.published_products p join public.robotics_admissions a using(product_id)
 join public.published_supplier_profiles s using(organization_id)
 where p.withdrawn_at is null and s.withdrawn_at is null and p.source_revision=a.product_revision and s.source_revision=a.company_revision;
grant select on public.robotics_products to anon,authenticated;
create function public.robotics_token(value text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(translate(public.catalogue_token(value),'àâäéèêëîïôöùûüç','aaaeeeeiioouuuc'),'n[ ·]*m\M','nm','g'),'([0-9]),([0-9])','\1.\2','g'),
 '\m(robotique|robotic|robotics|robots)\M','robot','g'),
 '\m(préhenseur|préhenseurs|prehenseur|prehenseurs|pince|pinces|grippers)\M','gripper','g'),
 '\m(servomoteur|servomoteurs|servo motor|servo motors)\M','servo','g'),
 '\m(réducteur|réducteurs|reducteur|reducteurs|gearboxes)\M','gearbox','g'),
 '\m(encodeur|encodeurs|encoders)\M','encoder','g')
$$;
create function public.robotics_technical_fit(spec jsonb,criteria jsonb) returns integer language plpgsql immutable set search_path='' as $$
declare fit integer:=1; value text; amount numeric;
begin
 if coalesce(criteria->>'connection','')<>'' then
  fit:=case when coalesce(spec->>'interface','')='' then 0 when strpos(lower(spec->>'interface'),lower(criteria->>'connection'))>0 then 1 else -1 end;
 end if;
 if coalesce(criteria->>'minimum','')<>'' or coalesce(criteria->>'maximum','')<>'' then
  value:=spec->>(criteria->>'metric');
  if coalesce(value,'')!~'^[0-9]+([.][0-9]+)?$' then return least(fit,0);end if;
  amount:=value::numeric;
  if (coalesce(criteria->>'minimum','')<>'' and amount < (criteria->>'minimum')::numeric)
   or (coalesce(criteria->>'maximum','')<>'' and amount > (criteria->>'maximum')::numeric) then return -1;end if;
 end if;
 return fit;
end$$;
revoke all on function public.robotics_token(text),public.robotics_technical_fit(jsonb,jsonb) from public;
grant execute on function public.robotics_token(text),public.robotics_technical_fit(jsonb,jsonb) to anon,authenticated;
create or replace function public.search_robotics_catalogue(criteria jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
with items as (
 select s.organization_id,s.display_name,s.country_code,s.city,s.description,s.published_at,s.public_details,p.product_id,p.name,p.category,p.description as product_description,p.specifications,
 least(
 public.robotics_technical_fit(p.specifications,criteria),
 case when coalesce(criteria->>'process','')='' then 1 when coalesce(p.specifications->>'processes','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'processes'),public.catalogue_token(criteria->>'process'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'material','')='' then 1 when coalesce(p.specifications->>'materials','')='' then 0 when strpos(public.catalogue_token(p.specifications->>'materials'),public.catalogue_token(criteria->>'material'))>0 then 1 else -1 end,
 case when coalesce(criteria->>'country','')='' then 1 when coalesce(p.specifications->>'manufacturing_country','')='' then 0 when criteria->>'country'='EU' and p.specifications->>'manufacturing_country'=any(array['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']) then 1 when p.specifications->>'manufacturing_country'=criteria->>'country' then 1 else -1 end,
 case when coalesce(criteria->>'quantity','')='' then 1 when coalesce(p.specifications->>'minimum_quantity','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(p.specifications->>'unit','')='' then 0 when p.specifications->>'unit'<>criteria->>'unit' then 0 when (p.specifications->>'minimum_quantity')::numeric <= nullif(criteria->>'quantity','')::numeric then 1 else -1 end
 ) as fit
 from public.robotics_products p join public.published_supplier_profiles s using(organization_id)
 where p.withdrawn_at is null and s.withdrawn_at is null
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
select jsonb_build_object('suppliers',coalesce((select jsonb_agg(to_jsonb(p)-'fit') from paged p),'[]'),'count',(select count(*) from grouped),'page',greatest(1,coalesce((criteria->>'page')::int,1)),'families',coalesce((select jsonb_object_agg(category,n) from (select category,count(*) n from public.robotics_products group by category) f),'{}'::jsonb))
$$;

revoke all on function public.search_robotics_catalogue(jsonb) from public;
grant execute on function public.search_robotics_catalogue(jsonb) to anon,authenticated;
