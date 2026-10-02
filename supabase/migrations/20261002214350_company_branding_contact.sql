-- Company branding is staged privately. Only selected images are publicly readable.
create table private.company_images(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.supplier_applications(owner_id) on delete cascade,kind text not null check(kind in ('logo','cover')),object_path text not null unique,size integer not null check(size between 1 and 3145728),created_at timestamptz not null default now());
alter table private.company_images enable row level security;
revoke all on private.company_images from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gsl-company-images','gsl-company-images',false,3145728,array['image/webp']);
create function private.company_image_public(image_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.published_supplier_profiles p where p.withdrawn_at is null and (p.public_details#>>'{branding,logoId}'=image_id::text or coalesce(p.public_details#>'{branding,coverIds}','[]'::jsonb)?image_id::text))
$$;
create function private.company_image_access(path text, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.company_images i where i.object_path=path and ((i.owner_id=auth.uid() and (not writing or exists(select 1 from public.supplier_applications a where a.owner_id=auth.uid() and a.status in ('draft','changes_requested')))) or (not writing and private.company_image_public(i.id))))
$$;
revoke all on function private.company_image_public(uuid),private.company_image_access(text,boolean) from public;
grant execute on function private.company_image_public(uuid),private.company_image_access(text,boolean) to anon,authenticated;
create policy company_images_read on storage.objects for select to anon,authenticated using(bucket_id='gsl-company-images' and private.company_image_access(name,false));
create policy company_images_insert on storage.objects for insert to authenticated with check(bucket_id='gsl-company-images' and private.company_image_access(name,true));
create policy company_images_remove on storage.objects for delete to authenticated using(bucket_id='gsl-company-images' and private.company_image_access(name,true) and not exists(select 1 from public.published_supplier_profiles p where p.withdrawn_at is null and p.public_details::text like '%'||split_part(name,'.',1)||'%'));
create function private.company_image(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i private.company_images; a public.supplier_applications; image_id uuid;
begin
 if action='read' then
  select * into i from private.company_images where id=(args->>'id')::uuid;
  if i.id is null or not private.company_image_access(i.object_path,false) then raise exception 'NOT_FOUND';end if;
  return jsonb_build_object('path',i.object_path,'kind',i.kind);
 end if;
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'LOGIN_REQUIRED';end if;
 select * into a from public.supplier_applications where owner_id=auth.uid() for update;
 if a.owner_id is null or a.status not in ('draft','changes_requested') then raise exception 'SAVE_FIRST';end if;
 if action='reserve' then
  if (select count(*) from private.company_images where owner_id=auth.uid())>=40 then raise exception 'IMAGE_LIMIT';end if;
  image_id=gen_random_uuid();insert into private.company_images(id,owner_id,kind,object_path,size) values(image_id,auth.uid(),args->>'kind',image_id::text||'.webp',(args->>'size')::int) returning * into i;
  return jsonb_build_object('id',i.id,'path',i.object_path);
 elsif action='cancel' then
  delete from private.company_images where id=(args->>'id')::uuid and owner_id=auth.uid() and not private.company_image_public(id) and not exists(select 1 from storage.objects o where o.bucket_id='gsl-company-images' and o.name=company_images.object_path);
  return '{}'::jsonb;
 end if;
 raise exception 'INVALID';
end $$;
create function public.company_image(action text,args jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.company_image(action,args)$$;
revoke all on function private.company_image(text,jsonb),public.company_image(text,jsonb) from public;
grant execute on function private.company_image(text,jsonb),public.company_image(text,jsonb) to anon,authenticated;

alter function private.publish_supplier_basics(jsonb,integer) rename to publish_supplier_basics_core;
revoke all on function private.publish_supplier_basics_core(jsonb,integer) from public,anon,authenticated;
create function private.publish_supplier_basics(profile jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; branding jsonb=coalesce(profile->'branding','{"logoId":"","coverIds":[]}'::jsonb); image_id text; expected_kind text; details jsonb;
begin
 if jsonb_typeof(branding) is distinct from 'object' or jsonb_typeof(coalesce(branding->'coverIds','[]')) is distinct from 'array' or jsonb_array_length(coalesce(branding->'coverIds','[]'))>5 then raise exception 'IMAGE_LIMIT';end if;
 for image_id,expected_kind in select value,'cover' from jsonb_array_elements_text(coalesce(branding->'coverIds','[]')) union all select branding->>'logoId','logo' where coalesce(branding->>'logoId','')<>'' loop
  if not exists(select 1 from private.company_images i join storage.objects o on o.bucket_id='gsl-company-images' and o.name=i.object_path where i.id::text=image_id and i.owner_id=auth.uid() and i.kind=expected_kind and (o.metadata->>'size')::int=i.size) then raise exception 'IMAGE_NOT_READY';end if;
 end loop;
 result=private.publish_supplier_basics_core(profile,expected_revision);
 details=jsonb_build_object('branding',jsonb_build_object('logoId',coalesce(branding->>'logoId',''),'coverIds',coalesce(branding->'coverIds','[]')));
 if profile#>>'{contact,publish}'='true' then details=details||jsonb_build_object('referenceContact',jsonb_build_object('name',left(profile#>>'{contact,name}',250),'role',left(coalesce(profile#>>'{contact,role}',''),250),'email',left(profile#>>'{contact,email}',254),'phone',left(coalesce(profile#>>'{contact,phone}',''),250)));end if;
 update public.published_supplier_profiles set public_details=public_details||details where organization_id=(result->>'organization_id')::uuid;
 return result;
end $$;
revoke all on function private.publish_supplier_basics(jsonb,integer) from public,anon;
grant execute on function private.publish_supplier_basics(jsonb,integer) to authenticated;
create or replace function public.publish_supplier_basics(profile jsonb,expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.publish_supplier_basics(profile,expected_revision)$$;
