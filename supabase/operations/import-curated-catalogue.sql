-- Reviewed server-side data import, run inside a transaction by PostgreSQL's
-- administrative connection. Inputs are client-loaded JSON plus its SHA-256,
-- and the real initiating owner ID. This is not a client RPC or an Auth session.
-- Set transaction-local gsl.import_payload / gsl.import_digest / gsl.import_actor
-- before running. Replaying a completed identical batch never overwrites edits.
do $import$
declare
 payload jsonb := current_setting('gsl.import_payload')::jsonb;
 digest text := current_setting('gsl.import_digest');
 actor uuid := current_setting('gsl.import_actor')::uuid;
 batch text;
 previous private.curated_catalogue_imports;
 company jsonb;
 product jsonb;
 guide jsonb;
 organization uuid;
 product_id uuid;
 company_source text;
 organization_revision integer;
 product_revision integer;
 saved_sub text := current_setting('request.jwt.claim.sub',true);
begin
 if current_user <> 'postgres' then raise exception 'SERVER_IMPORT_ONLY';end if;
 if not exists(select 1 from private.platform_admins a where a.user_id=actor and a.role='owner' and private.admin_user_is_active(a.user_id)) then raise exception 'INITIATING_OWNER_REQUIRED';end if;
 if (select count(*) from private.platform_admins a where a.role='owner' and private.admin_user_is_active(a.user_id))<>2 then raise exception 'EXPECTED_TWO_ELIGIBLE_OWNERS';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload->>'schemaVersion' is distinct from '1'
  or payload->>'batchId' is distinct from 'gsl-research-2026-10-09' or payload->>'checkedAt' is distinct from '2026-10-09'
  or digest !~ '^[a-f0-9]{64}$' or jsonb_array_length(payload->'companies')<>50 or jsonb_array_length(payload->'products')<>78
  or jsonb_array_length(payload->'agreements')<>10 or not private.curated_public_payload_is_safe(payload) then raise exception 'INVALID_IMPORT';end if;
 batch:=payload->>'batchId';
 perform pg_advisory_xact_lock(hashtextextended('curated-import:'||batch,47));
 select * into previous from private.curated_catalogue_imports where batch_id=batch for update;
 if previous.batch_id is not null then
  if previous.source_digest<>digest or previous.completed_at is null then raise exception 'BATCH_REQUIRES_REVIEW';end if;
  return;
 end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(payload->'companies'))<>50
  or (select count(distinct value->>'source_id') from jsonb_array_elements(payload->'companies'))<>50
  or (select count(distinct value->>'id') from jsonb_array_elements(payload->'products'))<>78
  or (select count(distinct value->>'source_key') from jsonb_array_elements(payload->'products'))<>78 then raise exception 'DUPLICATE_IMPORT_IDENTIFIER';end if;
 if exists(select 1 from jsonb_array_elements(payload->'companies') c group by c->>'country' having count(*)<>5)
  or (select count(distinct value->>'country') from jsonb_array_elements(payload->'companies'))<>10 then raise exception 'INVALID_COUNTRY_DISTRIBUTION';end if;
 if exists(select 1 from public.organizations o join jsonb_array_elements(payload->'companies') c on o.id=(c->>'id')::uuid or lower(o.legal_name)=lower(c->>'name'))
  or exists(select 1 from public.products p join jsonb_array_elements(payload->'products') d on p.id=(d->>'id')::uuid) then raise exception 'EXISTING_RECORD_REQUIRES_REVIEW';end if;
 for company in select value from jsonb_array_elements(payload->'companies') loop
  if not private.curated_company_research_valid(company#>'{details,research}',company->>'source_id')
   or not exists(select 1 from jsonb_array_elements(payload->'products') p where p->>'companyId'=company->>'id') then raise exception 'INVALID_COMPANY %',company->>'source_id';end if;
 end loop;
 for product in select value from jsonb_array_elements(payload->'products') loop
  select c->>'source_id' into company_source from jsonb_array_elements(payload->'companies') c where c->>'id'=product->>'companyId';
  if company_source is null or not private.curated_product_research_valid((product#>>'{specifications,research_data}')::jsonb,product->>'source_key',company_source) then raise exception 'INVALID_PRODUCT %',product->>'source_key';end if;
 end loop;
 insert into private.curated_catalogue_imports(batch_id,initiated_by,source_digest,company_count,product_count)
 values(batch,actor,digest,50,78);
 for guide in select value from jsonb_array_elements(payload->'agreements') loop
  insert into private.curated_country_guides(country_code,agreement,checked_at) values(guide->>'country',guide->'agreement',(payload->>'checkedAt')::date);
 end loop;
 -- Attribution required by existing creation/audit triggers. No AAL or token is
 -- forged, and this operation is recorded explicitly as a server import.
 perform set_config('request.jwt.claim.sub',actor::text,true);
 for company in select value from jsonb_array_elements(payload->'companies') loop
  organization:=(company->>'id')::uuid;
  insert into public.organizations(id,created_by,legal_name,trading_name,country_code,entity_kind,description,website,supplier)
  values(organization,actor,company->>'name',company->>'name',company->>'country','company',company->>'description',company->>'website',true);
  -- Only the automatic membership for this newly-created record is removed.
  -- The managed membership reconciler then grants both verified GSL owners
  -- tracked administrator access; no manufacturer account is asserted.
  delete from public.memberships where organization_id=organization and user_id=actor;
  insert into private.curated_catalogue_companies(organization_id,source_id,batch_id) values(organization,company->>'source_id',batch);
 end loop;
 for product in select value from jsonb_array_elements(payload->'products') loop
  organization:=(product->>'companyId')::uuid;product_id:=(product->>'id')::uuid;
  insert into public.products(id,organization_id,name,model_reference,category,description,made_to_order,specifications)
  values(product_id,organization,product->>'name',product->>'reference',product->>'category',product->>'description',(product->>'made_to_order')::boolean,product->'specifications');
  insert into private.curated_catalogue_products(product_id,source_key) values(product_id,product->>'source_key');
 end loop;
 -- Publish projections last, after all revision-affecting data has been written.
 for company in select value from jsonb_array_elements(payload->'companies') loop
  organization:=(company->>'id')::uuid;
  select revision into organization_revision from public.organizations where id=organization;
  insert into public.published_supplier_profiles(organization_id,source_revision,display_name,country_code,city,description,processes,materials,manufacturing_countries,public_details)
  values(organization,organization_revision,company->>'name',company->>'country',company->>'city',company->>'description',
   array(select jsonb_array_elements_text(company->'processes')),array(select jsonb_array_elements_text(company->'materials')),array[company->>'country'],company->'details');
 end loop;
 for product in select value from jsonb_array_elements(payload->'products') loop
  product_id:=(product->>'id')::uuid;
  select revision into product_revision from public.products where id=product_id;
  insert into public.published_products(product_id,organization_id,source_revision,name,category,description,specifications)
  values(product_id,(product->>'companyId')::uuid,product_revision,product->>'name',product->>'category',product->>'description',product->'specifications');
 end loop;
 perform private.sync_curated_catalogue_owners();
 if (select count(*) from private.curated_catalogue_owner_memberships m join private.curated_catalogue_companies c using(organization_id) where c.batch_id=batch)<>100 then raise exception 'OWNER_MEMBERSHIP_COUNT_MISMATCH';end if;
 if (select count(*) from private.curated_catalogue_companies c join public.published_supplier_profiles p using(organization_id) where c.batch_id=batch and p.withdrawn_at is null)<>50
  or (select count(*) from private.curated_catalogue_products c join public.published_products p using(product_id))<>78 then raise exception 'IMPORT_COUNT_MISMATCH';end if;
 update private.curated_catalogue_imports set completed_at=now() where batch_id=batch;
 perform set_config('request.jwt.claim.sub',coalesce(saved_sub,''),true);
end
$import$;
