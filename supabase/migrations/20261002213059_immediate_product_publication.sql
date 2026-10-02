-- Private identity mapping keeps public URLs stable when a reference changes.
create table private.supplier_product_links (
 owner_id uuid not null references public.supplier_applications(owner_id) on delete cascade,
 source_id uuid not null,
 product_id uuid not null unique references public.products(id) on delete cascade,
 primary key(owner_id,source_id)
);
alter table private.supplier_product_links enable row level security;
revoke all on private.supplier_product_links from public,anon,authenticated;
insert into private.supplier_product_links(owner_id,source_id,product_id)
select a.owner_id,(v->>'id')::uuid,p.id from public.supplier_applications a
cross join lateral jsonb_array_elements(case when jsonb_typeof(a.payload->'products')='array' then a.payload->'products' else '[]'::jsonb end) v
join public.products p on p.organization_id=a.organization_id and p.model_reference=coalesce(nullif(v->>'reference',''),v->>'id')
where coalesce(v->>'id','')~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
on conflict do nothing;

create function private.publish_supplier_products(profile jsonb, expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid(); a public.supplier_applications; item jsonb; product uuid; kept uuid[]='{}'; source uuid; spec jsonb;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'LOGIN_REQUIRED';end if;
 if jsonb_typeof(profile) is distinct from 'object' or octet_length(profile::text)>180000 or jsonb_typeof(profile->'products') is distinct from 'array' or jsonb_array_length(profile->'products')>30 then raise exception 'INVALID';end if;
 if coalesce(profile->>'attestation','false')<>'true' then raise exception 'INCOMPLETE';end if;
 select * into a from public.supplier_applications where owner_id=actor for update;
 if a.owner_id is null or a.revision is distinct from expected_revision then raise exception 'CONFLICT';end if;
 if a.status not in ('draft','changes_requested') then raise exception 'LOCKED';end if;
 if a.organization_id is null then raise exception 'COMPANY_REQUIRED';end if;
 if not private.is_member(a.organization_id,array['owner','admin']) then raise exception 'FORBIDDEN';end if;
 perform 1 from public.published_supplier_profiles where organization_id=a.organization_id and withdrawn_at is null for share;
 if not found then raise exception 'COMPANY_REQUIRED';end if;
 if (select count(*) from jsonb_array_elements(profile->'products'))<>(select count(distinct v->>'id') from jsonb_array_elements(profile->'products') v) then raise exception 'INVALID';end if;
 for item in select value from jsonb_array_elements(profile->'products') loop
  if coalesce(item->>'listingStatus','publish')='draft' then continue;end if;
  if coalesce(item->>'listingStatus','publish')<>'publish' or length(trim(coalesce(item->>'name',''))) not between 1 and 250
  or coalesce(item->>'category','') not in ('metal','machines','electricite','construction','plasturgie','textile','emballage','mobilier','other')
  or length(trim(coalesce(item->>'description',''))) not between 30 and 5000 or coalesce(item->>'origin','')!~'^[A-Z]{2}$'
  or coalesce(item->>'id','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'INCOMPLETE';end if;
  source=(item->>'id')::uuid;product=null;
  select product_id into product from private.supplier_product_links where owner_id=actor and source_id=source;
  spec=jsonb_build_object('materials',left(coalesce(item->>'materials',''),250),'processes',left(coalesce(item->>'processes',''),250),'manufacturing_country',item->>'origin','reference',left(coalesce(item->>'reference',''),250),'lead_time',left(coalesce(item->>'leadTime',''),250),'minimum_quantity',case when coalesce(item->>'moq','')~'^[0-9]+([.][0-9]+)?$' and coalesce(item->>'unit','')<>'' then left(item->>'moq',30) else '' end,'unit',left(coalesce(item->>'unit',''),250),'compliance','not_assessed','verification','unverified');
  if product is null then
   insert into public.products(organization_id,name,model_reference,category,description,specifications) values(a.organization_id,trim(item->>'name'),source::text,item->>'category',item->>'description',spec) returning id into product;
   insert into private.supplier_product_links(owner_id,source_id,product_id) values(actor,source,product);
  else
   update public.products set name=trim(item->>'name'),category=item->>'category',description=item->>'description',specifications=spec where id=product and organization_id=a.organization_id;
   if not found then raise exception 'FORBIDDEN';end if;
  end if;
  insert into public.published_products(product_id,organization_id,source_revision,name,category,description,specifications)
  select id,organization_id,revision,name,category,description,specifications from public.products where id=product
  on conflict(product_id) do update set source_revision=excluded.source_revision,name=excluded.name,category=excluded.category,description=excluded.description,specifications=excluded.specifications,published_at=now(),withdrawn_at=null;
  kept=array_append(kept,product);
 end loop;
 -- Explicitly private or removed products no longer appear publicly.
 update public.published_products p set withdrawn_at=now() where p.organization_id=a.organization_id and not(p.product_id=any(kept)) and exists(select 1 from private.supplier_product_links l where l.owner_id=actor and l.product_id=p.product_id);
 -- Company edits remain private until its own Publish action.
 update public.supplier_applications set payload=profile,status='draft' where owner_id=actor returning * into a;
 return jsonb_build_object('revision',a.revision,'status',a.status,'updated_at',a.updated_at,'published_count',cardinality(kept));
end $$;
create function public.publish_supplier_products(profile jsonb, expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.publish_supplier_products(profile,expected_revision)$$;
revoke all on function private.publish_supplier_products(jsonb,integer),public.publish_supplier_products(jsonb,integer) from public,anon;
grant execute on function private.publish_supplier_products(jsonb,integer),public.publish_supplier_products(jsonb,integer) to authenticated;
