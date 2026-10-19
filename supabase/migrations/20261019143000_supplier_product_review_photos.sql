-- Supplier submissions are private. Only active owner/admin accounts with AAL2 publish them.
create table private.supplier_product_reviews (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.supplier_applications(owner_id),
 source_id uuid not null,organization_id uuid not null references public.organizations(id),
 payload jsonb not null,status text not null check(status in ('pending','approved','changes_requested','withdrawn')),
 revision integer not null default 1,product_id uuid references public.products(id),
 feedback text not null default '',submitted_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references auth.users(id),
 unique(owner_id,source_id)
);
create table private.supplier_product_review_events (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references private.supplier_product_reviews(id),
 revision integer not null,actor_id uuid not null references auth.users(id),decision text not null,
 payload jsonb not null,feedback text not null,created_at timestamptz not null default now()
);
create table private.product_images (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.supplier_applications(owner_id),
 source_id uuid not null,object_path text not null unique,size integer not null check(size between 1 and 3145728),
 ready boolean not null default false,created_at timestamptz not null default now()
);
alter table private.supplier_product_reviews enable row level security;
alter table private.supplier_product_review_events enable row level security;
alter table private.product_images enable row level security;
revoke all on private.supplier_product_reviews,private.supplier_product_review_events,private.product_images from public,anon,authenticated;
create trigger supplier_product_audit_immutable before update or delete on private.supplier_product_review_events for each row execute function private.admin_audit_immutable();
create trigger supplier_product_audit_no_truncate before truncate on private.supplier_product_review_events for each statement execute function private.admin_audit_immutable();

create function private.is_product_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','aal1')='aal2' and private.admin_user_is_active(auth.uid())
 and exists(select 1 from private.platform_admins where user_id=auth.uid() and role in ('owner','admin'))
$$;
create function private.product_photo_ids(value text) returns jsonb language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(value::jsonb)='array' then return value::jsonb;end if;return '[]'::jsonb;
exception when invalid_text_representation then return '[]'::jsonb;
end $$;
revoke all on function private.product_photo_ids(text) from public,anon,authenticated;
create function private.product_image_public(image_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.product_images i join public.published_products p
 on private.product_photo_ids(p.specifications->>'photo_ids') ? i.id::text
 join public.published_supplier_profiles s using(organization_id)
 where i.id=image_id and i.ready and p.withdrawn_at is null and s.withdrawn_at is null
 and public.gsl_sourcing_country(s.country_code) and public.gsl_sourcing_country(p.specifications->>'manufacturing_country'))
$$;
create function private.product_image_access(path text,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.product_images i where i.object_path=path and
 ((i.owner_id=auth.uid() and private.admin_user_is_active(auth.uid()) and
 (not writing or exists(select 1 from public.supplier_applications a where a.owner_id=auth.uid() and a.status in ('draft','changes_requested')) and not private.product_image_public(i.id)))
 or (not writing and (private.is_product_admin() or private.product_image_public(i.id)))))
$$;
revoke all on function private.is_product_admin(),private.product_image_public(uuid),private.product_image_access(text,boolean) from public;
grant execute on function private.product_image_access(text,boolean) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gsl-product-images','gsl-product-images',false,3145728,array['image/webp']);
create policy product_images_read on storage.objects for select to anon,authenticated using(bucket_id='gsl-product-images' and private.product_image_access(name,false));
create policy product_images_insert on storage.objects for insert to authenticated with check(bucket_id='gsl-product-images' and private.product_image_access(name,true));
create policy product_images_remove on storage.objects for delete to authenticated using(bucket_id='gsl-product-images' and private.product_image_access(name,true));

create function private.product_image(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i private.product_images;a public.supplier_applications;source uuid;
begin
 if action='read' then
  select * into i from private.product_images where id=(args->>'id')::uuid;
  if i.id is null or not i.ready or not private.product_image_access(i.object_path,false) then raise exception 'NOT_FOUND';end if;
  return jsonb_build_object('path',i.object_path);
 end if;
 if not private.admin_user_is_active(auth.uid()) then raise exception 'LOGIN_REQUIRED';end if;
 select * into a from public.supplier_applications where owner_id=auth.uid() for update;
 if a.owner_id is null or a.status not in ('draft','changes_requested') then raise exception 'SAVE_FIRST';end if;
 if action='reserve' then
  source=(args->>'product')::uuid;
  if not exists(select 1 from jsonb_array_elements(coalesce(a.payload->'products','[]')) p where p->>'id'=source::text) then raise exception 'SAVE_FIRST';end if;
  if (select count(*) from private.product_images where owner_id=auth.uid())>=100 then raise exception 'IMAGE_LIMIT';end if;
  insert into private.product_images(owner_id,source_id,object_path,size)
  values(auth.uid(),source,gen_random_uuid()::text||'.webp',(args->>'size')::integer) returning * into i;
  return jsonb_build_object('id',i.id,'path',i.object_path);
 elsif action='finalize' then
  update private.product_images set ready=true where id=(args->>'id')::uuid and owner_id=auth.uid()
  and exists(select 1 from storage.objects o where o.bucket_id='gsl-product-images' and o.name=product_images.object_path and (o.metadata->>'size')::integer=product_images.size) returning * into i;
  if i.id is null then raise exception 'IMAGE_NOT_READY';end if;
 elsif action='cancel' then
  delete from private.product_images where id=(args->>'id')::uuid and owner_id=auth.uid() and not ready
  and not exists(select 1 from storage.objects o where o.bucket_id='gsl-product-images' and o.name=product_images.object_path);
 else raise exception 'INVALID';end if;
 return '{}'::jsonb;
end $$;
create function public.product_image(action text,args jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.product_image(action,args)$$;
revoke all on function private.product_image(text,jsonb),public.product_image(text,jsonb) from public;
grant execute on function private.product_image(text,jsonb),public.product_image(text,jsonb) to anon,authenticated;

create function private.validate_supplier_product(item jsonb,actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare photo text;
begin
 if jsonb_typeof(item) is distinct from 'object' or length(trim(coalesce(item->>'name',''))) not between 1 and 250
 or coalesce(item->>'category','') not in ('metal','machines','electricite','construction','plasturgie','textile','emballage','mobilier','other')
 or length(trim(coalesce(item->>'description',''))) not between 30 and 5000 or not public.gsl_sourcing_country(item->>'origin')
 or coalesce(item->>'id','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or coalesce(item->>'moq','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(item->>'unit','') not in ('pcs','set','kg','m','m2')
 or length(coalesce(item->>'family',''))=0 or jsonb_typeof(item->'specs') is distinct from 'object' then raise exception 'INCOMPLETE';end if;
 if (item->>'moq')::numeric<=0 then raise exception 'INCOMPLETE';end if;
 if jsonb_typeof(coalesce(item->'photoIds','[]')) is distinct from 'array' or jsonb_array_length(coalesce(item->'photoIds','[]'))>5 then raise exception 'IMAGE_LIMIT';end if;
 if (select count(*) from jsonb_array_elements_text(coalesce(item->'photoIds','[]')))<>(select count(distinct value) from jsonb_array_elements_text(coalesce(item->'photoIds','[]'))) then raise exception 'INVALID';end if;
 for photo in select value from jsonb_array_elements_text(coalesce(item->'photoIds','[]')) loop
  if not exists(select 1 from private.product_images i join storage.objects o on o.bucket_id='gsl-product-images' and o.name=i.object_path
   where i.id::text=photo and i.owner_id=actor and i.source_id::text=item->>'id' and i.ready and (o.metadata->>'size')::integer=i.size) then raise exception 'IMAGE_NOT_READY';end if;
 end loop;
end $$;
revoke all on function private.validate_supplier_product(jsonb,uuid) from public,anon,authenticated;

-- Preserve the API name for existing clients; its behavior is now submission, never publication.
create or replace function private.publish_supplier_products(profile jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid();a public.supplier_applications;item jsonb;kept uuid[]='{}';r private.supplier_product_reviews;
begin
 if not private.admin_user_is_active(actor) then raise exception 'LOGIN_REQUIRED';end if;
 if jsonb_typeof(profile) is distinct from 'object' or octet_length(profile::text)>180000 or jsonb_typeof(profile->'products') is distinct from 'array' or jsonb_array_length(profile->'products')>30 then raise exception 'INVALID';end if;
 if coalesce(profile->>'attestation','false')<>'true' then raise exception 'INCOMPLETE';end if;
 select * into a from public.supplier_applications where owner_id=actor for update;
 if a.owner_id is null or a.revision is distinct from expected_revision then raise exception 'CONFLICT';end if;
 if a.status not in ('draft','changes_requested') then raise exception 'LOCKED';end if;
 if a.organization_id is null then raise exception 'COMPANY_REQUIRED';end if;
 if not private.is_member(a.organization_id,array['owner','admin']) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.published_supplier_profiles where organization_id=a.organization_id and withdrawn_at is null) then raise exception 'COMPANY_REQUIRED';end if;
 if (select count(*) from jsonb_array_elements(profile->'products'))<>(select count(distinct v->>'id') from jsonb_array_elements(profile->'products') v) then raise exception 'INVALID';end if;
 for item in select value from jsonb_array_elements(profile->'products') loop
  if item->>'listingStatus'='draft' then continue;end if;
  if coalesce(item->>'listingStatus','publish')<>'publish' then raise exception 'INVALID';end if;
  perform private.validate_supplier_product(item,actor);
  kept=array_append(kept,(item->>'id')::uuid);
  insert into private.supplier_product_reviews(owner_id,source_id,organization_id,payload,status)
   values(actor,(item->>'id')::uuid,a.organization_id,item,'pending')
   on conflict(owner_id,source_id) do update set payload=excluded.payload,organization_id=excluded.organization_id,status='pending',revision=supplier_product_reviews.revision+1,feedback='',submitted_at=now(),reviewed_at=null,reviewed_by=null
   where supplier_product_reviews.payload is distinct from excluded.payload or supplier_product_reviews.organization_id<>excluded.organization_id or supplier_product_reviews.status in ('changes_requested','withdrawn');
 end loop;
 -- Explicit removal/draft withdrawal is immediate; other approved versions stay online during review.
 update public.published_products p set withdrawn_at=now() where p.organization_id=a.organization_id and exists(select 1 from private.supplier_product_links l where l.owner_id=actor and l.product_id=p.product_id and not(l.source_id=any(kept)));
 update private.supplier_product_reviews set status='withdrawn',revision=revision+1 where owner_id=actor and not(source_id=any(kept)) and status<>'withdrawn';
 update public.supplier_applications set payload=profile,status='draft' where owner_id=actor returning * into a;
 return jsonb_build_object('revision',a.revision,'status',a.status,'updated_at',a.updated_at,'submitted_count',cardinality(kept));
end $$;

-- Extend the reviewed catalogue's component families without changing historical admissions.
alter table public.robotics_admissions drop constraint robotics_admissions_family_check;
alter table public.robotics_admissions add constraint robotics_admissions_family_check check(family in ('robots-plateformes','actionnement-transmission','transmissions-guidages','prehension','capteurs-vision','commande-electronique','mecanique-cablage','cables-connecteurs','energie-batteries','pieces-mecaniques'));

create function private.supplier_product_review(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.supplier_product_reviews;a public.supplier_applications;product uuid;spec jsonb;company public.published_supplier_profiles;result jsonb;owner uuid;note text;
begin
 if action='own' then
  if not private.admin_user_is_active(auth.uid()) then raise exception 'LOGIN_REQUIRED';end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'sourceId',source_id,'revision',revision,'status',status,'payload',payload,'productId',product_id,'feedback',feedback,'submittedAt',submitted_at)),'[]') from private.supplier_product_reviews where owner_id=auth.uid());
 end if;
 perform private.require_admin();
 if not private.is_product_admin() then raise exception 'PERMISSION_REQUIRED';end if;
 if action='queue' then
  return (select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (
   select qrev.id,qrev.source_id as "sourceId",qrev.revision,qrev.status,qrev.payload,qrev.product_id as "productId",qrev.feedback,qrev.submitted_at as "submittedAt",s.display_name as "companyName",s.city as "companyCity"
   from private.supplier_product_reviews qrev join public.published_supplier_profiles s using(organization_id)
   where qrev.status='pending' order by qrev.submitted_at,qrev.id limit 100)q);
 end if;
 if action not in ('approve','changes_requested') then raise exception 'INVALID';end if;
 perform private.lock_admin_permission(null);
 if not private.is_product_admin() then raise exception 'PERMISSION_REQUIRED';end if;
 select owner_id into owner from private.supplier_product_reviews where id=(args->>'id')::uuid;
 select * into a from public.supplier_applications where owner_id=owner for update;
 select * into r from private.supplier_product_reviews where id=(args->>'id')::uuid for update;
 if r.id is null then raise exception 'NOT_FOUND';end if;
 if r.status<>'pending' or r.revision is distinct from (args->>'revision')::integer then raise exception 'CONFLICT';end if;
 note=trim(coalesce(args->>'feedback',''));
 if length(note) not between 5 and 2000 then raise exception 'FEEDBACK_REQUIRED';end if;
 if action='approve' then
  if a.organization_id is distinct from r.organization_id or not private.admin_user_is_active(r.owner_id) or not exists(select 1 from public.memberships where user_id=r.owner_id and organization_id=r.organization_id and active and role in ('owner','admin')) then raise exception 'FORBIDDEN';end if;
  select * into company from public.published_supplier_profiles where organization_id=r.organization_id and withdrawn_at is null for share;
  if company.organization_id is null then raise exception 'COMPANY_REQUIRED';end if;
  perform private.validate_supplier_product(r.payload,r.owner_id);
  if coalesce(args->>'family','') not in ('actionnement-transmission','transmissions-guidages','prehension','capteurs-vision','commande-electronique','cables-connecteurs','energie-batteries','pieces-mecaniques')
  or length(trim(coalesce(args->>'site',''))) not between 3 and 500 or length(trim(coalesce(args->>'roboticsOffer',''))) not between 21 and 4000
  or private.curated_sources_valid(args->'sources') is distinct from true
  or private.curated_public_payload_is_safe(jsonb_build_object('site',args->'site','offer',args->'roboticsOffer','sources',args->'sources')) is distinct from true then raise exception 'INVALID';end if;
  select product_id into product from private.supplier_product_links where owner_id=r.owner_id and source_id=r.source_id;
  spec=jsonb_build_object('materials',left(coalesce(r.payload->>'materials',''),250),'processes',left(coalesce(r.payload->>'processes',''),250),'manufacturing_country',r.payload->>'origin','reference',left(coalesce(r.payload->>'reference',''),250),'lead_time',left(coalesce(r.payload->>'leadTime',''),250),'minimum_quantity',r.payload->>'moq','unit',r.payload->>'unit','compliance','not_assessed','verification','unverified','photo_ids',coalesce(r.payload->'photoIds','[]')::text);
  if product is null then
   insert into public.products(organization_id,name,model_reference,category,description,specifications) values(r.organization_id,trim(r.payload->>'name'),r.source_id::text,r.payload->>'category',r.payload->>'description',spec) returning id into product;
   insert into private.supplier_product_links(owner_id,source_id,product_id) values(r.owner_id,r.source_id,product);
  else
   update public.products set name=trim(r.payload->>'name'),category=r.payload->>'category',description=r.payload->>'description',specifications=spec where id=product and organization_id=r.organization_id;
   if not found then raise exception 'FORBIDDEN';end if;
  end if;
  insert into public.published_products(product_id,organization_id,source_revision,name,category,description,specifications)
   select id,organization_id,revision,name,category,description,specifications from public.products where id=product
   on conflict(product_id) do update set source_revision=excluded.source_revision,name=excluded.name,category=excluded.category,description=excluded.description,specifications=excluded.specifications,published_at=now(),withdrawn_at=null;
  insert into public.robotics_admissions(product_id,product_revision,company_revision,family,production_country,production_site,robotics_offer,sources,checked_at,technical,reviewed_by)
   select product,source_revision,company.source_revision,args->>'family',r.payload->>'origin',trim(args->>'site'),trim(args->>'roboticsOffer'),args->'sources',current_date,'{}',auth.uid() from public.published_products where product_id=product
   on conflict(product_id) do update set product_revision=excluded.product_revision,company_revision=excluded.company_revision,family=excluded.family,production_country=excluded.production_country,production_site=excluded.production_site,robotics_offer=excluded.robotics_offer,sources=excluded.sources,checked_at=excluded.checked_at,technical=excluded.technical,reviewed_by=excluded.reviewed_by;
 end if;
 insert into private.supplier_product_review_events(request_id,revision,actor_id,decision,payload,feedback) values(r.id,r.revision,auth.uid(),action,r.payload,note);
 update private.supplier_product_reviews set status=case when action='approve' then 'approved' else 'changes_requested' end,product_id=coalesce(product,product_id),feedback=note,reviewed_at=now(),reviewed_by=auth.uid(),revision=revision+1 where id=r.id;
 return jsonb_build_object('saved',true,'productId',product);
end $$;
create function public.supplier_product_review(action text,args jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.supplier_product_review(action,args)$$;
revoke all on function private.supplier_product_review(text,jsonb),public.supplier_product_review(text,jsonb) from public,anon;
grant execute on function private.supplier_product_review(text,jsonb),public.supplier_product_review(text,jsonb) to authenticated;

create function public.submit_supplier_products(profile jsonb,expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.publish_supplier_products(profile,expected_revision)$$;
revoke all on function public.submit_supplier_products(jsonb,integer) from public,anon;
grant execute on function public.submit_supplier_products(jsonb,integer) to authenticated;
