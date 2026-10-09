-- Curated catalogue access and transactional message notifications.
-- Requires private.curated_catalogue_companies from the catalogue migration.
-- No historical message/contact backfill and no network calls are performed.

create table private.curated_catalogue_owner_memberships (
 organization_id uuid not null,
 user_id uuid not null,
 created_at timestamptz not null default now(),
 primary key (organization_id,user_id),
 foreign key (organization_id,user_id) references public.memberships(organization_id,user_id) on delete cascade
);
alter table private.curated_catalogue_owner_memberships enable row level security;
revoke all on private.curated_catalogue_owner_memberships from public,anon,authenticated;
create index curated_owner_memberships_user on private.curated_catalogue_owner_memberships(user_id);

-- Only memberships inserted here receive a provenance record. Existing customer
-- memberships are neither promoted nor removed by this synchronization.
create function private.sync_curated_catalogue_owners() returns jsonb
language plpgsql security definer set search_path='' as $$
declare added integer; removed integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('gsl-curated-catalogue-owner-memberships',0));
 delete from public.memberships m using private.curated_catalogue_owner_memberships p
 where m.organization_id=p.organization_id and m.user_id=p.user_id
 and (not exists(select 1 from private.curated_catalogue_companies c where c.organization_id=p.organization_id)
  or not private.admin_user_is_active(p.user_id)
  or not exists(select 1 from private.platform_admins a where a.user_id=p.user_id and a.role='owner'));
 get diagnostics removed=row_count;
 with inserted as (
  insert into public.memberships(organization_id,user_id,role,active)
  select c.organization_id,a.user_id,'admin',true
  from private.curated_catalogue_companies c cross join private.platform_admins a
  where a.role='owner' and private.admin_user_is_active(a.user_id)
  on conflict(organization_id,user_id) do nothing returning organization_id,user_id
 ) insert into private.curated_catalogue_owner_memberships(organization_id,user_id)
 select organization_id,user_id from inserted;
 get diagnostics added=row_count;
 return jsonb_build_object('added',added,'removed',removed);
end $$;
revoke all on function private.sync_curated_catalogue_owners() from public,anon,authenticated;

create function private.sync_curated_owner_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform private.sync_curated_catalogue_owners();
 return null;
end $$;
revoke all on function private.sync_curated_owner_trigger() from public,anon,authenticated;
create trigger curated_catalogue_owner_sync after insert or update or delete on private.curated_catalogue_companies
for each statement execute function private.sync_curated_owner_trigger();
create trigger platform_owner_catalogue_sync after insert or update or delete on private.platform_admins
for each statement execute function private.sync_curated_owner_trigger();

-- JSON comparisons also support the minimal Auth schema used by local fixtures.
-- A sign-in update restores memberships after a temporary ban has expired.
create function private.sync_curated_owner_auth_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.platform_admins where user_id=new.id and role='owner')
 or exists(select 1 from private.curated_catalogue_owner_memberships where user_id=new.id) then
  perform private.sync_curated_catalogue_owners();
 end if;
 return null;
end $$;
revoke all on function private.sync_curated_owner_auth_trigger() from public,anon,authenticated;
create trigger auth_owner_catalogue_sync after update on auth.users
for each row execute function private.sync_curated_owner_auth_trigger();

-- Ordinary company permissions retain their existing behavior. Memberships
-- supplied for GSL editorial management additionally require a live owner and AAL2.
create or replace function private.is_member(org uuid,permitted_roles text[] default array['owner','admin','procurement','sales','viewer'])
returns boolean language sql volatile security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid()
  and m.active and m.role=any(permitted_roles)
  and (not exists(select 1 from private.curated_catalogue_owner_memberships p where p.organization_id=m.organization_id and p.user_id=m.user_id)
   or (coalesce(auth.jwt()->>'aal','aal1')='aal2' and private.admin_user_is_active(m.user_id)
    and exists(select 1 from private.platform_admins a where a.user_id=m.user_id and a.role='owner'))))
$$;

create function private.messaging_access() returns jsonb
language plpgsql security definer set search_path='' as $$
declare is_owner boolean; has_mfa boolean;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 is_owner:=private.admin_user_is_active(auth.uid()) and exists(select 1 from private.platform_admins where user_id=auth.uid() and role='owner');
 has_mfa:=coalesce(auth.jwt()->>'aal','aal1')='aal2';
 -- Deterministic restoration after a ban expires, using the live role. No caller
 -- can choose another user or a role, and no access is exposed before AAL2.
 if is_owner and has_mfa then perform private.sync_curated_catalogue_owners();end if;
 return jsonb_build_object(
  'mfaRequired',is_owner and not has_mfa and exists(select 1 from private.curated_catalogue_companies),
  'managedOrganizationIds',coalesce((select jsonb_agg(c.organization_id order by c.organization_id)
   from private.curated_catalogue_companies c
   where private.is_member(c.organization_id,array['owner','admin','procurement','sales'])),'[]'::jsonb));
end $$;
create function public.messaging_access() returns jsonb language sql security invoker set search_path='' as $$select private.messaging_access()$$;
revoke all on function private.messaging_access(),public.messaging_access() from public,anon;
grant execute on function private.messaging_access(),public.messaging_access() to authenticated;

create or replace function private.messaging_summary(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if coalesce(cardinality(p_ids),0)>31 then raise exception 'INVALID';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'last_body',last_message.body,
  'supplier_managed_by_gsl',exists(select 1 from private.curated_catalogue_companies x where x.organization_id=c.supplier_organization_id),
  'unread',(select count(*) from public.product_messages m where m.conversation_id=c.id and m.sender_user_id<>auth.uid()
   and not exists(select 1 from private.message_reads r where r.user_id=auth.uid() and r.message_id=m.id))))
 from public.product_conversations c left join lateral(select body from public.product_messages where conversation_id=c.id order by created_at desc,id desc limit 1)last_message on true
 where c.id=any(p_ids) and private.can_read_product_conversation(c.id)),'[]'::jsonb);
end $$;

alter table public.notification_outbox add column recipient_organization_id uuid references public.organizations(id) on delete set null;
alter table public.notification_outbox alter column template_version set default '2026-10-09';

create function private.notify_direct_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare conversation public.product_conversations; recipient_org uuid; recipient_role text;
begin
 select * into conversation from public.product_conversations where id=new.conversation_id;
 if new.sender_organization_id=conversation.buyer_organization_id then
  recipient_org:=conversation.supplier_organization_id;recipient_role:='sales';
 elsif new.sender_organization_id=conversation.supplier_organization_id then
  recipient_org:=conversation.buyer_organization_id;recipient_role:='procurement';
 else raise exception 'INVALID_MESSAGE_ORGANIZATION';end if;
 insert into public.notification_outbox(event_key,recipient_id,recipient_organization_id,template,resource_id)
 select 'direct-message:'||new.id||':'||m.user_id,m.user_id,recipient_org,'direct_message',new.conversation_id
 from public.memberships m where m.organization_id=recipient_org and m.active
 and m.role in ('owner','admin',recipient_role) and m.user_id<>new.sender_user_id
 and private.admin_user_is_active(m.user_id)
 and (not exists(select 1 from private.curated_catalogue_owner_memberships p where p.organization_id=m.organization_id and p.user_id=m.user_id)
  or exists(select 1 from private.platform_admins a where a.user_id=m.user_id and a.role='owner'))
 on conflict(event_key) do nothing;
 return new;
end $$;
revoke all on function private.notify_direct_message() from public,anon,authenticated;
create trigger notify_direct_message after insert on public.product_messages
for each row execute function private.notify_direct_message();

-- General enquiries are routed to the actual owners, not to supplier contacts.
create function private.notify_contact_owners() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.notification_outbox(event_key,recipient_id,template,resource_id)
 select 'contact-operator:'||new.id||':'||a.user_id,a.user_id,'contact_operator',new.id
 from private.platform_admins a where a.role='owner' and private.admin_user_is_active(a.user_id)
 on conflict(event_key) do nothing;
 return new;
end $$;
revoke all on function private.notify_contact_owners() from public,anon,authenticated;
create trigger notify_contact_owners after insert on public.contact_requests
for each row execute function private.notify_contact_owners();

create or replace function private.submit_contact(request_id uuid,email text,name text,subject text,body text,language text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if request_id is null or email is null or name is null or subject is null or body is null or language is null
 or length(email)>254 or email!~'^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'
 or length(trim(name)) not between 2 and 150 or length(trim(subject)) not between 3 and 150
 or length(trim(body)) not between 20 and 5000 or language not in ('en','fr','es','pt','de','it','tr','ar','hi','zh') then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('gsl-contact-global',0));
 if exists(select 1 from public.contact_requests c where c.id=request_id) then
  if exists(select 1 from public.contact_requests c where c.id=request_id and c.email=lower(submit_contact.email) and c.body=submit_contact.body) then return request_id;end if;
  raise exception 'CONFLICT';
 end if;
 if (select count(*) from public.contact_requests where created_at>now()-interval '1 minute')>=30
 or (select count(*) from public.contact_requests c where c.email=lower(submit_contact.email) and created_at>now()-interval '1 hour')>=3 then raise exception 'RATE_LIMITED';end if;
 insert into public.contact_requests(id,email,name,subject,body,language) values(request_id,lower(email),name,subject,body,language);
 insert into public.notification_outbox(event_key,recipient_email,template,resource_id,language)
 values('contact:'||request_id,lower(email),'contact_received',request_id,case when language='fr' then 'fr' else 'en' end);
 return request_id;
end $$;

-- Recheck queued recipients after a role change. SMTP delivery never receives a
-- revoked/inactive member merely because they were eligible when the event arose.
create function private.notification_recipient_eligible(n public.notification_outbox) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if n.recipient_id is null then return n.recipient_email is not null;end if;
 if not private.admin_user_is_active(n.recipient_id) then return false;end if;
 if n.template='contact_operator' then
  return exists(select 1 from private.platform_admins a where a.user_id=n.recipient_id and a.role='owner');
 end if;
 if n.template='direct_message' then
  return exists(select 1 from public.product_conversations c join public.memberships m on m.organization_id=n.recipient_organization_id
   where c.id=n.resource_id and m.user_id=n.recipient_id and m.active
   and ((m.organization_id=c.buyer_organization_id and m.role in ('owner','admin','procurement'))
    or (m.organization_id=c.supplier_organization_id and m.role in ('owner','admin','sales')))
   and (not exists(select 1 from private.curated_catalogue_owner_memberships p where p.organization_id=m.organization_id and p.user_id=m.user_id)
    or exists(select 1 from private.platform_admins a where a.user_id=m.user_id and a.role='owner')));
 end if;
 if n.template='rfq_cancelled' then
  return exists(select 1 from public.rfq_recipients r join public.memberships m on m.organization_id=r.supplier_organization_id
   where r.rfq_id=n.resource_id and m.user_id=n.recipient_id and m.active and m.role in ('owner','admin','sales')
   and (not exists(select 1 from private.curated_catalogue_owner_memberships p where p.organization_id=m.organization_id and p.user_id=m.user_id)
    or exists(select 1 from private.platform_admins a where a.user_id=m.user_id and a.role='owner')));
 end if;
 if n.template in ('new_rfq','new_message','new_offer','offer_selected') then
  return exists(select 1 from public.threads t join public.rfqs r on r.id=t.rfq_id
   join public.memberships m on m.user_id=n.recipient_id and m.active
   where t.id=n.resource_id
   and ((m.organization_id=t.supplier_organization_id and m.role in ('owner','admin','sales') and n.template<>'new_offer')
    or (m.organization_id=r.organization_id and m.role in ('owner','admin','procurement') and n.template not in ('new_rfq','offer_selected')))
   and (not exists(select 1 from private.curated_catalogue_owner_memberships p where p.organization_id=m.organization_id and p.user_id=m.user_id)
    or exists(select 1 from private.platform_admins a where a.user_id=m.user_id and a.role='owner')));
 end if;
 return true;
end $$;
revoke all on function private.notification_recipient_eligible(public.notification_outbox) from public,anon,authenticated;

create or replace function private.claim_notifications(lease_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if lease_id is null then raise exception 'INVALID';end if;
 update public.notification_outbox set state='failed',failure_code='WORKER_INTERRUPTED_DELIVERY_UNCERTAIN'
 where state='processing' and lease_until<now();
 update public.notification_outbox n set state='failed',failure_code='RECIPIENT_NO_LONGER_AUTHORIZED'
 where n.state='pending' and not private.notification_recipient_eligible(n);
 with batch as (
  select n.id from public.notification_outbox n where n.state='pending' and n.available_at<=now() and n.attempts<5
  order by n.available_at,n.id for update skip locked limit 2
 ), claimed as (
  update public.notification_outbox n set state='processing',lease_id=claim_notifications.lease_id,
  lease_until=now()+interval '2 minutes',attempts=attempts+1 from batch b where n.id=b.id returning n.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'attempts',c.attempts,'template',c.template,'language',c.language,
  'resource_id',c.resource_id,'email',coalesce(u.email,c.recipient_email))),'[]'::jsonb)
 into result from claimed c left join auth.users u on u.id=c.recipient_id;
 return result;
end $$;

-- Keep the existing RLS-backed workspace query. A null company now lists every
-- authorized request; request_id selects a precise record after choosing the
-- responding company. The optional argument preserves existing two-argument calls.
drop function public.workspace_requests(uuid,integer);
create function public.workspace_requests(company uuid,page_number integer default 0,request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if page_number is null or page_number<0 or page_number>100000 then raise exception 'INVALID';end if;
 if company is not null and not private.is_member(company) then raise exception 'FORBIDDEN';end if;
 with eligible as (
  select r.* from public.rfqs r
  where (request_id is null or r.id=request_id)
  and (company is null or r.organization_id=company or exists(select 1 from public.threads t where t.rfq_id=r.id and t.supplier_organization_id=company))
 ), page as (
  select * from eligible order by created_at desc,id desc limit 20 offset(page_number*20)
 ), conversations as (
  select t.* from public.threads t join page p on p.id=t.rfq_id
  where company is null or p.organization_id=company or t.supplier_organization_id=company
 )
 select jsonb_build_object(
  'total',(select count(*) from eligible),'page',page_number,'hasMore',(select count(*) from eligible)>(page_number+1)*20,
  'rfqs',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc),'[]') from page p),
  'threads',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from conversations t),
  'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.rfq_items i where i.rfq_id in(select id from page)),
  'offers',(select coalesce(jsonb_agg(to_jsonb(o) order by o.version desc),'[]') from public.offers o where o.thread_id in(select id from conversations))
 ) into result;
 return result;
end $$;
revoke all on function public.workspace_requests(uuid,integer,uuid) from public,anon;
grant execute on function public.workspace_requests(uuid,integer,uuid) to authenticated;

-- Safe for an empty catalogue; the importer also calls this explicitly at end.
select private.sync_curated_catalogue_owners();
