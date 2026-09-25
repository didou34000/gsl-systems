-- GSL foundation. No legacy data imported. Publication and sending require server workflows.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.country_requirement_versions (
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  version text not null,
  specification jsonb not null check (jsonb_typeof(specification) = 'object'),
  researched_at date not null,
  primary key (country_code, version)
);
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  language text not null default 'en' check (language in ('en','fr')),
  created_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id),
  legal_name text not null check (length(trim(legal_name)) between 2 and 250),
  trading_name text not null default '',
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  entity_kind text not null check (entity_kind in ('company','sole_trader','other')),
  legal_form text not null default '',
  description text not null default '',
  website text,
  buyer boolean not null default false,
  supplier boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer or supplier)
);
create table public.memberships (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','procurement','sales','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_by_user on public.memberships(user_id, organization_id) where active;
create table public.organization_identifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  identifier_type text not null,
  value text not null check (length(value) between 1 and 250),
  authority text not null default '',
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  requirement_version text,
  unique (organization_id, identifier_type, authority),
  foreign key (country_code, requirement_version) references public.country_requirement_versions(country_code, version)
);
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  kind text not null check (kind in ('registered_office','billing','delivery','production')),
  line1 text not null, line2 text not null default '', city text not null,
  region text not null default '', postal_code text not null default '',
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  public_precision text not null default 'city' check (public_precision in ('private','city','exact')),
  unique (organization_id,id)
);
create unique index one_registered_office on public.addresses(organization_id) where kind='registered_office';
create table public.production_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  address_id uuid not null,
  name text not null,
  relationship text not null check (relationship in ('owned','leased','subcontracted')),
  description text not null default '',
  workforce_range text,
  area_square_meters numeric check (area_square_meters > 0),
  unique (organization_id,id),
  foreign key (organization_id,address_id) references public.addresses(organization_id,id)
);
create table public.organization_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null, job_title text not null default '',
  email text, phone text, languages text[] not null default '{}',
  publication_consent_at timestamptz,
  public boolean not null default false,
  check (not public or publication_consent_at is not null)
);
create table public.capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  site_id uuid,
  process text not null,
  materials text[] not null default '{}',
  equipment text not null default '',
  description text not null default '',
  capacity numeric check (capacity > 0), capacity_unit text, capacity_period text,
  minimum_quantity numeric check (minimum_quantity > 0), quantity_unit text,
  unique (organization_id,id),
  foreign key (organization_id,site_id) references public.production_sites(organization_id,id),
  check (capacity is null or (capacity_unit is not null and capacity_period is not null)),
  check (minimum_quantity is null or quantity_unit is not null)
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  site_id uuid,
  name text not null, model_reference text not null,
  category text not null, description text not null default '',
  made_to_order boolean not null default true,
  specifications jsonb not null default '{}',
  revision integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id), unique(organization_id,model_reference),
  foreign key (organization_id,site_id) references public.production_sites(organization_id,id)
);
create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  object_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  purpose text not null check (purpose in ('logo','company_photo','site_photo','product_photo','registry','certificate','drawing','quote','other')),
  media_origin text check (media_origin in ('supplier_provided','illustration')),
  caption text not null default '',
  rights_attested_at timestamptz,
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','rejected')),
  created_at timestamptz not null default now(),
  unique(organization_id,id),
  check (object_path = organization_id::text || '/' || id::text)
);
create table public.media_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  file_id uuid not null, site_id uuid, product_id uuid,
  position integer not null default 0 check(position >= 0),
  alt_en text not null default '', alt_fr text not null default '',
  check (num_nonnulls(site_id,product_id) <= 1),
  foreign key(organization_id,file_id) references public.files(organization_id,id),
  foreign key(organization_id,site_id) references public.production_sites(organization_id,id),
  foreign key(organization_id,product_id) references public.products(organization_id,id)
);
create table public.evidence_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  file_id uuid not null,
  kind text not null check (kind in ('registration','management_system','product_certificate','eu_declaration','test_report','other')),
  reference text not null, issuer text not null, standard text,
  issued_on date, expires_on date,
  scope_description text not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id),
  foreign key(organization_id,file_id) references public.files(organization_id,id),
  check (expires_on is null or issued_on is null or expires_on >= issued_on)
);
create table public.evidence_scopes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  evidence_id uuid not null, site_id uuid, product_id uuid, product_revision integer,
  scope_kind text not null check(scope_kind in ('organization','site','product')),
  foreign key(organization_id,evidence_id) references public.evidence_documents(organization_id,id),
  foreign key(organization_id,site_id) references public.production_sites(organization_id,id),
  foreign key(organization_id,product_id) references public.products(organization_id,id),
  check ((scope_kind='organization' and site_id is null and product_id is null and product_revision is null)
    or (scope_kind='site' and site_id is not null and product_id is null and product_revision is null)
    or (scope_kind='product' and product_id is not null and product_revision > 0 and site_id is null))
);
create table public.product_compliance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null, product_revision integer not null check(product_revision > 0),
  intended_use text not null,
  destination_markets text[] not null default '{}',
  ce_applicability text not null default 'not_assessed' check(ce_applicability in ('not_assessed','applicable','not_applicable')),
  applicability_reason text not null default '',
  legislation text[] not null default '{}', standards text[] not null default '{}',
  assessment_procedure text not null default '', notified_body_number text,
  foreign key(organization_id,product_id) references public.products(organization_id,id),
  check (notified_body_number is null or notified_body_number ~ '^[0-9]{4}$'),
  check (ce_applicability='not_assessed' or length(trim(applicability_reason)) > 0)
);
create table private.platform_reviewers (
  user_id uuid primary key references auth.users(id),
  granted_at timestamptz not null default now()
);
create table public.verification_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid, evidence_id uuid, reviewed_revision integer not null check(reviewed_revision > 0),
  reviewer_id uuid not null references auth.users(id),
  decision text not null check(decision in ('information_requested','checked','rejected','revoked')),
  method text not null, source_url text, note text not null,
  checked_at timestamptz not null default now(), next_review_at timestamptz,
  check(num_nonnulls(product_id,evidence_id) <= 1),
  foreign key(organization_id,product_id) references public.products(organization_id,id),
  foreign key(organization_id,evidence_id) references public.evidence_documents(organization_id,id)
);
create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  title text not null, details text not null default '',
  mode text not null default 'autonomous' check(mode in ('autonomous','assisted')),
  assistance_shared_at timestamptz,
  state text not null default 'draft' check(state in ('draft','sent','closed','cancelled')),
  destination_country text check(destination_country ~ '^[A-Z]{2}$'),
  deadline date, revision integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id),
  check(assistance_shared_at is null or mode='assisted')
);
create table public.rfq_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  rfq_id uuid not null, description text not null,
  selected_product_id uuid references public.products(id),
  quantity numeric not null check(quantity > 0), unit text not null,
  specifications jsonb not null default '{}',
  foreign key(organization_id,rfq_id) references public.rfqs(organization_id,id)
);
create table public.rfq_recipients (
  rfq_id uuid not null references public.rfqs(id),
  supplier_organization_id uuid not null references public.organizations(id),
  sent_at timestamptz not null default now(),
  primary key(rfq_id,supplier_organization_id)
);
create table public.rfq_files (
  organization_id uuid not null,
  rfq_id uuid not null, file_id uuid not null,
  primary key(rfq_id,file_id),
  foreign key(organization_id,rfq_id) references public.rfqs(organization_id,id),
  foreign key(organization_id,file_id) references public.files(organization_id,id)
);
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null, supplier_organization_id uuid not null,
  created_at timestamptz not null default now(),
  unique(rfq_id,supplier_organization_id),
  unique(id,supplier_organization_id),
  foreign key(rfq_id,supplier_organization_id) references public.rfq_recipients(rfq_id,supplier_organization_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id),
  sender_organization_id uuid not null references public.organizations(id),
  sender_user_id uuid not null default auth.uid() references auth.users(id),
  body text not null check(length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  supplier_organization_id uuid not null,
  version integer not null check(version > 0),
  amount_minor bigint not null check(amount_minor >= 0),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  quantity numeric not null check(quantity > 0), unit text not null,
  terms text not null, lead_time_assumptions text not null,
  valid_until date not null,
  created_at timestamptz not null default now(),
  unique(thread_id,version),
  foreign key(thread_id,supplier_organization_id) references public.threads(id,supplier_organization_id)
);
create table public.declared_orders (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers(id),
  buyer_organization_id uuid not null references public.organizations(id),
  reference text not null, note text not null default '',
  declared_at timestamptz not null default now()
);
create table public.published_supplier_profiles (
  organization_id uuid primary key references public.organizations(id),
  source_revision integer not null,
  display_name text not null, country_code text not null,
  city text not null, description text not null,
  published_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create table public.published_products (
  product_id uuid primary key references public.products(id),
  organization_id uuid not null,
  source_revision integer not null,
  name text not null, category text not null, description text not null,
  published_at timestamptz not null default now(), withdrawn_at timestamptz,
  foreign key(organization_id,product_id) references public.products(organization_id,id)
);

-- These helpers read membership tables without recursive RLS. They cannot change data.
create function private.is_member(org uuid, permitted_roles text[] default array['owner','admin','procurement','sales','viewer'])
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.memberships m
    where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role=any(permitted_roles));
$$;
create function private.is_reviewer() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from private.platform_reviewers r where r.user_id=auth.uid());
$$;
create function private.can_read_rfq(request_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.rfqs r where r.id=request_id and
    (private.is_member(r.organization_id,array['owner','admin','procurement']) or
      (r.state <> 'draft' and exists(select 1 from public.rfq_recipients x where x.rfq_id=r.id and private.is_member(x.supplier_organization_id,array['owner','admin','sales']))) or
      (r.mode='assisted' and r.assistance_shared_at is not null and private.is_reviewer())));
$$;
create function private.can_edit_draft(request_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.rfqs r where r.id=request_id and r.state='draft' and private.is_member(r.organization_id,array['owner','admin','procurement']));
$$;
create function private.can_read_thread(thread uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.threads t join public.rfqs r on r.id=t.rfq_id where t.id=thread and r.state <> 'draft' and
    (private.is_member(t.supplier_organization_id,array['owner','admin','sales']) or private.is_member(r.organization_id,array['owner','admin','procurement'])));
$$;
create function private.can_read_file(file uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.files f where f.id=file and
    (private.is_member(f.organization_id,array['owner','admin','procurement','sales']) or
      (f.scan_status='clean' and exists(select 1 from public.rfq_files a where a.file_id=f.id and private.can_read_rfq(a.rfq_id)))));
$$;
create function private.seed_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or new.created_by <> auth.uid() then raise exception 'Authenticated organization creator required'; end if;
  insert into public.memberships(organization_id,user_id,role) values(new.id,auth.uid(),'owner');
  return new;
end; $$;
create trigger seed_owner after insert on public.organizations for each row execute function private.seed_owner();
create function private.bump_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision=old.revision+1; new.updated_at=now(); return new; end; $$;
create trigger organization_revision before update on public.organizations for each row execute function private.bump_revision();
create trigger product_revision before update on public.products for each row execute function private.bump_revision();
create trigger evidence_revision before update on public.evidence_documents for each row execute function private.bump_revision();
create trigger rfq_revision before update on public.rfqs for each row execute function private.bump_revision();

-- Default deny, then explicit grants. No client writes to publication, review or sending state.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
alter table private.platform_reviewers enable row level security;
revoke all on private.platform_reviewers from anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid,text[]), private.is_reviewer(), private.can_read_rfq(uuid), private.can_edit_draft(uuid), private.can_read_thread(uuid), private.can_read_file(uuid) to authenticated;

create policy country_read on public.country_requirement_versions for select to authenticated using(true);
create policy profile_read on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create policy profile_create on public.profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy profile_edit on public.profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant insert(user_id,display_name,language), update(display_name,language) on public.profiles to authenticated;
create policy organization_read on public.organizations for select to authenticated using(private.is_member(id));
create policy organization_create on public.organizations for insert to authenticated with check(created_by=(select auth.uid()));
create policy organization_edit on public.organizations for update to authenticated using(private.is_member(id,array['owner','admin'])) with check(private.is_member(id,array['owner','admin']));
grant insert(legal_name,trading_name,country_code,entity_kind,legal_form,description,website,buyer,supplier) on public.organizations to authenticated;
grant update(legal_name,trading_name,country_code,entity_kind,legal_form,description,website,buyer,supplier) on public.organizations to authenticated;
create policy membership_read on public.memberships for select to authenticated using(private.is_member(organization_id));

do $$ declare t text; begin
  foreach t in array array['organization_identifiers','addresses','production_sites','organization_contacts','capabilities','products','media_links','evidence_documents','evidence_scopes','product_compliance_records'] loop
    execute format('create policy member_read on public.%I for select to authenticated using(private.is_member(organization_id))',t);
    execute format('create policy member_create on public.%I for insert to authenticated with check(private.is_member(organization_id,array[''owner'',''admin'']))',t);
    execute format('create policy member_edit on public.%I for update to authenticated using(private.is_member(organization_id,array[''owner'',''admin''])) with check(private.is_member(organization_id,array[''owner'',''admin'']))',t);
    execute format('grant insert, update on public.%I to authenticated',t);
  end loop;
end $$;
-- Forbid moving existing resources between organizations, even for a shared administrator.
create function private.immutable_organization() returns trigger language plpgsql set search_path='' as $$
begin if new.organization_id <> old.organization_id or new.id <> old.id then raise exception 'Resource identity is immutable'; end if; return new; end; $$;
do $$ declare t text; begin
  foreach t in array array['organization_identifiers','addresses','production_sites','organization_contacts','capabilities','products','media_links','evidence_documents','evidence_scopes','product_compliance_records'] loop
    execute format('create trigger immutable_organization before update on public.%I for each row execute function private.immutable_organization()',t);
  end loop;
end $$;
revoke execute on function private.immutable_organization() from public,anon,authenticated;

create policy files_read on public.files for select to authenticated using(private.can_read_file(id));
create policy files_create on public.files for insert to authenticated with check(private.is_member(organization_id,array['owner','admin','procurement','sales']) and uploaded_by=(select auth.uid()) and scan_status='pending');
grant insert(id,organization_id,object_path,original_name,mime_type,size_bytes,purpose,media_origin,caption,rights_attested_at) on public.files to authenticated;
create policy verification_read on public.verification_events for select to authenticated using(private.is_member(organization_id) or (select private.is_reviewer()));
create policy rfq_read on public.rfqs for select to authenticated using(private.can_read_rfq(id));
create policy rfq_create on public.rfqs for insert to authenticated with check(private.is_member(organization_id,array['owner','admin','procurement']) and created_by=(select auth.uid()) and state='draft' and assistance_shared_at is null and exists(select 1 from public.organizations o where o.id=organization_id and o.buyer));
create policy rfq_edit on public.rfqs for update to authenticated using(private.can_edit_draft(id)) with check(private.can_edit_draft(id));
grant insert(organization_id,title,details,mode,destination_country,deadline), update(title,details,destination_country,deadline) on public.rfqs to authenticated;
create policy rfq_item_read on public.rfq_items for select to authenticated using(private.can_read_rfq(rfq_id));
create policy rfq_item_create on public.rfq_items for insert to authenticated with check(private.can_edit_draft(rfq_id));
create policy rfq_item_edit on public.rfq_items for update to authenticated using(private.can_edit_draft(rfq_id)) with check(private.can_edit_draft(rfq_id));
grant insert(organization_id,rfq_id,description,selected_product_id,quantity,unit,specifications), update(description,selected_product_id,quantity,unit,specifications) on public.rfq_items to authenticated;
create policy rfq_file_read on public.rfq_files for select to authenticated using(private.can_read_rfq(rfq_id));
create policy rfq_file_create on public.rfq_files for insert to authenticated with check(private.can_edit_draft(rfq_id));
grant insert on public.rfq_files to authenticated;
create policy recipients_read on public.rfq_recipients for select to authenticated using(private.is_member(supplier_organization_id,array['owner','admin','sales']) or exists(select 1 from public.rfqs r where r.id=rfq_id and private.is_member(r.organization_id,array['owner','admin','procurement'])));
create policy thread_read on public.threads for select to authenticated using(private.can_read_thread(id));
create policy messages_read on public.messages for select to authenticated using(private.can_read_thread(thread_id));
create policy messages_create on public.messages for insert to authenticated with check(sender_user_id=(select auth.uid()) and private.can_read_thread(thread_id) and exists(select 1 from public.threads t join public.rfqs r on r.id=t.rfq_id where t.id=thread_id and ((sender_organization_id=r.organization_id and private.is_member(sender_organization_id,array['owner','admin','procurement'])) or (sender_organization_id=t.supplier_organization_id and private.is_member(sender_organization_id,array['owner','admin','sales'])))));
grant insert(thread_id,sender_organization_id,body) on public.messages to authenticated;
create policy offers_read on public.offers for select to authenticated using(private.can_read_thread(thread_id));
create policy orders_read on public.declared_orders for select to authenticated using(private.is_member(buyer_organization_id,array['owner','admin','procurement']) or exists(select 1 from public.offers o where o.id=offer_id and private.is_member(o.supplier_organization_id,array['owner','admin','sales'])));

-- Public projections are curated, never SELECT * from private company records.
grant select on public.published_supplier_profiles, public.published_products to anon;
create policy supplier_public_read on public.published_supplier_profiles for select to anon,authenticated using(withdrawn_at is null);
create policy product_public_read on public.published_products for select to anon,authenticated using(withdrawn_at is null and exists(select 1 from public.published_supplier_profiles s where s.organization_id=published_products.organization_id and s.withdrawn_at is null));

-- Only a trusted review workflow may publish; edits withdraw old public information.
create function private.withdraw_company() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authenticated change required'; end if;
  update public.published_supplier_profiles set withdrawn_at=now() where organization_id=new.id;
  update public.published_products set withdrawn_at=now() where organization_id=new.id;
  return new;
end; $$;
create trigger withdraw_company after update on public.organizations for each row execute function private.withdraw_company();
create function private.withdraw_product() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authenticated change required'; end if;
  update public.published_products set withdrawn_at=now() where product_id=new.id;
  return new;
end; $$;
create trigger withdraw_product after update on public.products for each row execute function private.withdraw_product();
revoke execute on function private.withdraw_company(),private.withdraw_product() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('gsl-private','gsl-private',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','application/octet-stream']);
create policy gsl_private_read on storage.objects for select to authenticated using(bucket_id='gsl-private' and exists(select 1 from public.files f where f.object_path=name and private.can_read_file(f.id)));
create policy gsl_private_upload on storage.objects for insert to authenticated with check(bucket_id='gsl-private' and exists(select 1 from public.files f where f.object_path=name and f.uploaded_by=(select auth.uid()) and f.scan_status='pending' and private.is_member(f.organization_id,array['owner','admin','procurement','sales'])));
-- No overwrite or public bucket until scanning and curated publication are integrated.

-- Index referencing columns (including composite FKs) for tenant access and deletions.
do $$ declare r record; begin
  for r in
    select c.conrelid::regclass rel, c.conname, string_agg(quote_ident(a.attname),',' order by k.ord) cols
    from pg_constraint c cross join lateral unnest(c.conkey) with ordinality k(attnum,ord)
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
    join pg_namespace n on n.oid=c.connamespace
    where c.contype='f' and n.nspname in ('public','private')
    group by c.conrelid,c.conname
  loop execute format('create index %I on %s (%s)', 'gsl_fk_'||substr(md5(r.rel::text||r.conname),1,16),r.rel,r.cols); end loop;
end $$;
