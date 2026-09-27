-- Private pre-publication applications. Approval never follows from completeness.
create table public.supplier_applications (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{}' check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=180000),
 status text not null default 'draft' check(status in ('draft','submitted','in_review','changes_requested','reviewed')),
 revision integer not null default 1,
 reviewer_notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.supplier_application_files (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.supplier_applications(owner_id) on delete cascade,
 object_path text not null unique,
 kind text not null check(kind in ('logo','factory','product','registration','certificate','technical')),
 name text not null check(length(name) between 1 and 180),
 size integer not null check(size between 1 and 3145728),
 caption text not null default '' check(length(caption)<=250),
 created_at timestamptz not null default now(),
 check(object_path like owner_id::text || '/%')
);
create index supplier_application_files_owner on public.supplier_application_files(owner_id);
create table public.supplier_application_events (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.supplier_applications(owner_id) on delete cascade,
 status text not null,
 created_at timestamptz not null default now()
);
create index supplier_application_events_owner on public.supplier_application_events(owner_id,created_at desc);
alter table public.supplier_applications enable row level security;
alter table public.supplier_application_files enable row level security;
alter table public.supplier_application_events enable row level security;
revoke all on public.supplier_applications,public.supplier_application_files,public.supplier_application_events from anon,authenticated;
grant select on public.supplier_applications,public.supplier_application_files,public.supplier_application_events to authenticated;
grant insert(owner_id,payload,status) on public.supplier_applications to authenticated;
grant update(payload,status) on public.supplier_applications to authenticated;
grant insert(id,owner_id,object_path,kind,name,size,caption),delete on public.supplier_application_files to authenticated;
create policy application_read on public.supplier_applications for select to authenticated using(owner_id=(select auth.uid()));
create policy application_create on public.supplier_applications for insert to authenticated with check(owner_id=(select auth.uid()) and status in ('draft','submitted'));
create policy application_edit on public.supplier_applications for update to authenticated using(owner_id=(select auth.uid()) and status in ('draft','submitted','changes_requested')) with check(owner_id=(select auth.uid()) and status in ('draft','submitted'));
create policy application_file_read on public.supplier_application_files for select to authenticated using(owner_id=(select auth.uid()));
create policy application_file_create on public.supplier_application_files for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.supplier_applications a where a.owner_id=supplier_application_files.owner_id and a.status in ('draft','changes_requested')));
create policy application_file_remove on public.supplier_application_files for delete to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.supplier_applications a where a.owner_id=supplier_application_files.owner_id and a.status in ('draft','changes_requested')));
create policy application_event_read on public.supplier_application_events for select to authenticated using(owner_id=(select auth.uid()));
create function private.guard_supplier_application() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if auth.uid() is not null and old.status='submitted' and (new.status<>'draft' or new.payload<>old.payload) then raise exception 'Withdraw before editing'; end if;
  new.revision=old.revision+1;
 else new.revision=1;
 end if;
 new.updated_at=now(); return new;
end; $$;
revoke execute on function private.guard_supplier_application() from public,anon,authenticated;
create trigger guard_supplier_application before insert or update on public.supplier_applications for each row execute function private.guard_supplier_application();
-- Trigger-only writer so applicants cannot forge their review timeline.
create function private.record_supplier_application_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and auth.uid()<>new.owner_id then raise exception 'Owner mismatch'; end if;
 if TG_OP='INSERT' then insert into public.supplier_application_events(owner_id,status) values(new.owner_id,new.status);
 elsif old.status<>new.status then insert into public.supplier_application_events(owner_id,status) values(new.owner_id,new.status);
 end if; return new;
end; $$;
revoke execute on function private.record_supplier_application_event() from public,anon,authenticated;
create trigger supplier_application_event after insert or update on public.supplier_applications for each row execute function private.record_supplier_application_event();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gsl-onboarding','gsl-onboarding',false,3145728,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy onboarding_storage_read on storage.objects for select to authenticated using(bucket_id='gsl-onboarding' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy onboarding_storage_insert on storage.objects for insert to authenticated with check(bucket_id='gsl-onboarding' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.supplier_applications a where a.owner_id=(select auth.uid()) and a.status in ('draft','changes_requested')));
create policy onboarding_storage_delete on storage.objects for delete to authenticated using(bucket_id='gsl-onboarding' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.supplier_applications a where a.owner_id=(select auth.uid()) and a.status in ('draft','changes_requested')));
