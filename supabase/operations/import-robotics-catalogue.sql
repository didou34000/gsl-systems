-- Run in a transaction using the server administrative connection, after the
-- 2026-10-09 curated import. Set gsl.robotics_payload and gsl.import_actor.
-- Does not create accounts or grant ownership; requires an active GSL owner.
do $import$
declare actor uuid:=current_setting('gsl.import_actor')::uuid;payload jsonb:=current_setting('gsl.robotics_payload')::jsonb;p jsonb;a jsonb;pid uuid;oid uuid;pr integer;cr integer;saved_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 if current_user<>'postgres' then raise exception 'SERVER_IMPORT_ONLY';end if;
 if not exists(select 1 from private.platform_admins where user_id=actor and role='owner' and private.admin_user_is_active(actor)) then raise exception 'INITIATING_OWNER_REQUIRED';end if;
 if payload->>'schemaVersion'<>'1' or not private.curated_public_payload_is_safe(payload) then raise exception 'INVALID_IMPORT';end if;
 perform pg_advisory_xact_lock(hashtextextended('robotics-catalogue-import',47));
 perform set_config('request.jwt.claim.sub',actor::text,true);
 for p in select value from jsonb_array_elements(payload->'products') loop
  pid:=(p->>'id')::uuid;oid:=(p->>'companyId')::uuid;a:=p->'admission';
  if pid<>'018d8d2c-80fb-4fdc-9f55-96c054802712'::uuid or oid<>'e80142b0-eca4-56c7-919e-f689f5b4ff8f'::uuid or a->>'production_country'<>'RS' then raise exception 'REVIEW_REQUIRED';end if;
  if not exists(select 1 from private.curated_catalogue_companies c join public.published_supplier_profiles s using(organization_id) where c.organization_id=oid and s.withdrawn_at is null)
   or not private.curated_product_research_valid((p#>>'{specifications,research_data}')::jsonb,'inmold-robots-iml','F019') then raise exception 'REVIEW_REQUIRED';end if;
  -- Replays never overwrite products or admission decisions.
  if exists(select 1 from public.products where id=pid) then
   if exists(select 1 from private.curated_catalogue_products where product_id=pid and source_key='inmold-robots-iml') then continue;end if;
   raise exception 'EXISTING_RECORD_REQUIRES_REVIEW';
  end if;
  insert into public.products(id,organization_id,name,model_reference,category,description,made_to_order,specifications)
   values(pid,oid,p->>'name',p->>'reference',p->>'category',p->>'description',null,p->'specifications');
  insert into private.curated_catalogue_products(product_id,source_key) values(pid,'inmold-robots-iml');
  select revision into pr from public.products where id=pid;
  select source_revision into cr from public.published_supplier_profiles where organization_id=oid;
  insert into public.published_products(product_id,organization_id,source_revision,name,category,description,specifications)
   values(pid,oid,pr,p->>'name',p->>'category',p->>'description',p->'specifications');
  insert into public.robotics_admissions(product_id,product_revision,company_revision,family,production_country,production_site,robotics_offer,sources,checked_at,technical,reviewed_by)
   values(pid,pr,cr,a->>'family',a->>'production_country',a->>'production_site',a->>'robotics_offer',a->'sources',(a->>'checked_at')::date,a->'technical',actor);
  insert into private.curated_catalogue_events(actor_id,action,resource_id,revision) values(actor,'robotics_admission',pid,pr);
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(saved_sub,''),true);
end
$import$;
