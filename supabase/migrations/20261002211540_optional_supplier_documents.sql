-- Owner-requested company publication. No document, product or verification is published.
create function private.publish_supplier_basics(profile jsonb, expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.supplier_applications; org uuid; actor uuid=auth.uid(); live_products uuid[];
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'LOGIN_REQUIRED';end if;
 if jsonb_typeof(profile) is distinct from 'object' or octet_length(profile::text)>180000 or expected_revision<0 then raise exception 'INVALID';end if;
 if length(trim(coalesce(profile->>'legalName',''))) not between 2 and 250
 or coalesce(profile->>'country','')!~'^[A-Z]{2}$'
 or length(trim(coalesce(profile#>>'{headquarters,city}',''))) not between 1 and 250
 or length(trim(coalesce(profile->>'description',''))) not between 30 and 5000
 or coalesce(profile->>'activity','') not in ('manufacturer','subcontractor','distributor','intermediary','engineering')
 or length(trim(coalesce(profile#>>'{contact,name}',''))) not between 1 and 250
 or coalesce(profile#>>'{contact,email}','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or coalesce(profile->>'attestation','false')<>'true' then raise exception 'INCOMPLETE';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':supplier-publication',0));
 select * into a from public.supplier_applications where owner_id=actor for update;
 if coalesce(a.revision,0) is distinct from expected_revision then raise exception 'CONFLICT';end if;
 if a.owner_id is not null and a.status not in ('draft','changes_requested') then raise exception 'LOCKED';end if;
 org=a.organization_id;
 if org is not null then
  if not private.is_member(org,array['owner','admin']) then raise exception 'FORBIDDEN';end if;
  if exists(select 1 from public.published_supplier_profiles where organization_id=org and withdrawn_at is not null) then raise exception 'LOCKED';end if;
  select array_agg(product_id) into live_products from public.published_products where organization_id=org and withdrawn_at is null;
  update public.organizations set legal_name=trim(profile->>'legalName'),country_code=profile->>'country',description=profile->>'description',supplier=true where id=org;
 else
  insert into public.organizations(created_by,legal_name,country_code,entity_kind,description,supplier)
  values(actor,trim(profile->>'legalName'),profile->>'country','company',profile->>'description',true) returning id into org;
 end if;
 -- Identifiers, contacts, certificates and incomplete fields stay in the private draft.
 if a.owner_id is null then
  insert into public.supplier_applications(owner_id,payload,status,organization_id) values(actor,profile,'draft',org) returning * into a;
 else
  update public.supplier_applications set payload=profile,status='draft',organization_id=org where owner_id=actor returning * into a;
 end if;
 insert into public.published_supplier_profiles(organization_id,source_revision,display_name,country_code,city,description,processes,materials,manufacturing_countries,public_details)
 select org,o.revision,trim(profile->>'legalName'),profile->>'country',trim(profile#>>'{headquarters,city}'),profile->>'description',string_to_array(left(coalesce(profile#>>'{capabilities,processes}',''),5000),','),string_to_array(left(coalesce(profile#>>'{capabilities,materials}',''),5000),','),'{}',jsonb_build_object('activity',profile->>'activity','verification','unverified','equipment',left(coalesce(profile#>>'{capabilities,equipment}',''),5000),'quality',left(coalesce(profile#>>'{capabilities,quality}',''),5000),'languages',left(coalesce(profile#>>'{contact,languages}',''),250),'website',case when coalesce(profile->>'website','')~'^https?://[^[:space:]]+\.[^[:space:]]+' then left(profile->>'website',500) else null end) from public.organizations o where o.id=org
 on conflict(organization_id) do update set source_revision=excluded.source_revision,display_name=excluded.display_name,country_code=excluded.country_code,city=excluded.city,description=excluded.description,processes=excluded.processes,materials=excluded.materials,public_details=excluded.public_details,published_at=now(),withdrawn_at=null;
 update public.published_products set withdrawn_at=null where organization_id=org and product_id=any(coalesce(live_products,'{}'));
 return jsonb_build_object('revision',a.revision,'status',a.status,'updated_at',a.updated_at,'organization_id',org);
end $$;
create function public.publish_supplier_basics(profile jsonb, expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.publish_supplier_basics(profile,expected_revision)$$;
revoke all on function private.publish_supplier_basics(jsonb,integer),public.publish_supplier_basics(jsonb,integer) from public,anon;
grant execute on function private.publish_supplier_basics(jsonb,integer),public.publish_supplier_basics(jsonb,integer) to authenticated;
