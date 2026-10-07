-- Additive administrator RBAC. Existing grants become admin; no owner is created.
alter table private.platform_admins add column role text not null default 'admin' check(role in ('owner','admin','operator','analyst'));
alter table private.platform_admins add column updated_at timestamptz not null default now();
create table private.admin_access_state(singleton boolean primary key default true check(singleton),revision integer not null default 0 check(revision>=0));
insert into private.admin_access_state(singleton) values(true);
create table private.admin_access_events(
 id uuid primary key default gen_random_uuid(),actor_id uuid not null,target_id uuid not null,
 actor_email text not null,target_email text not null,action text not null check(action in ('access_granted','access_changed','access_revoked')),
 previous_role text check(previous_role in ('owner','admin','operator','analyst')),role text check(role in ('owner','admin','operator','analyst')),
 reason text not null check(length(trim(reason)) between 10 and 500),created_at timestamptz not null default now()
);
create index admin_access_events_recent on private.admin_access_events(created_at desc,id);
create table private.admin_export_events(
 id uuid primary key default gen_random_uuid(),actor_id uuid not null,resource text not null check(resource in ('overview','companies','products','contacts','activity','tasks')),
 row_count integer not null check(row_count>=0),truncated boolean not null,created_at timestamptz not null default now()
);
alter table private.admin_access_state enable row level security;
alter table private.admin_access_events enable row level security;
alter table private.admin_export_events enable row level security;
revoke all on private.admin_access_state,private.admin_access_events,private.admin_export_events from public,anon,authenticated;

-- Recheck live Auth status, including old JWTs issued before a suspension or
-- soft deletion. JSON access also lets minimal local Auth fixtures exercise migrations.
create function private.admin_user_is_active(p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user_id and u.email_confirmed_at is not null
  and to_jsonb(u)->>'deleted_at' is null
  and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity'::timestamptz)<=now())
$$;
create or replace function private.require_admin() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if not private.admin_user_is_active(auth.uid()) or not exists(select 1 from private.platform_admins where user_id=auth.uid()) then raise exception 'ADMIN_REQUIRED';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
end $$;
create or replace function private.admin_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare is_admin boolean; has_review boolean; has_mfa boolean; active_user boolean;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 active_user:=private.admin_user_is_active(auth.uid());
 select active_user and exists(select 1 from private.platform_admins where user_id=auth.uid()) into is_admin;
 select active_user and exists(select 1 from private.platform_reviewers where user_id=auth.uid()) into has_review;
 has_mfa:=coalesce(auth.jwt()->>'aal','aal1')='aal2';
 return jsonb_build_object('isAdmin',is_admin,'canReview',has_review and has_mfa,'mfaRequired',is_admin and not has_mfa);
end $$;

create function private.admin_role_permissions(p_role text) returns text[] language sql immutable set search_path='' as $$
 select case p_role
 when 'owner' then array['overview.read','catalog.read','contacts.read','contacts.manage','tasks.manage','activity.read','data.export','access.manage']
 when 'admin' then array['overview.read','catalog.read','contacts.read','contacts.manage','tasks.manage','activity.read','data.export']
 when 'operator' then array['overview.read','catalog.read','contacts.read','contacts.manage','tasks.manage','activity.read']
 when 'analyst' then array['overview.read','catalog.read','activity.read']
 else array[]::text[] end
$$;
create function private.admin_has_permission(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','aal1')='aal2' and private.admin_user_is_active(auth.uid()) and exists(
  select 1 from private.platform_admins a where a.user_id=auth.uid() and p_permission=any(private.admin_role_permissions(a.role)))
$$;
create function private.require_admin_permission(p_permission text) returns void language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin();
 if not private.admin_has_permission(p_permission) then raise exception 'PERMISSION_REQUIRED';end if;
end $$;

-- Writers hold a share lock on their own grant until transaction end. Revocation
-- and role changes wait for already-authorized writes; later writes recheck the live role.
create function private.lock_admin_permission(p_permission text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=auth.uid() for share;
 perform 1 from private.platform_admins where user_id=auth.uid() for share;
 if p_permission is null then perform private.require_admin();else perform private.require_admin_permission(p_permission);end if;
end $$;

create function private.admin_audit_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'AUDIT_IMMUTABLE';end $$;
create trigger admin_access_audit_immutable before update or delete on private.admin_access_events for each row execute function private.admin_audit_immutable();
create trigger admin_access_audit_no_truncate before truncate on private.admin_access_events for each statement execute function private.admin_audit_immutable();
create trigger admin_export_audit_immutable before update or delete on private.admin_export_events for each row execute function private.admin_audit_immutable();
create trigger admin_export_audit_no_truncate before truncate on private.admin_export_events for each statement execute function private.admin_audit_immutable();
create function private.guard_last_admin_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.role='owner' and (tg_op='DELETE' or new.role<>'owner') then
  perform 1 from private.admin_access_state where singleton for update;
  if (select count(*) from private.platform_admins where role='owner')<=1 then raise exception 'LAST_OWNER';end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 new.updated_at:=now();return new;
end $$;
create trigger admin_last_owner before update or delete on private.platform_admins for each row execute function private.guard_last_admin_owner();

-- Keep older implementations callable only by the database owner. They are not alternate APIs.
alter function private.admin_snapshot() rename to admin_snapshot_before_roles;
revoke all on function private.admin_snapshot_before_roles() from public,anon,authenticated;
alter function private.admin_mutate(jsonb) rename to admin_mutate_before_roles;
revoke all on function private.admin_mutate_before_roles(jsonb) from public,anon,authenticated;

-- Shared allowlisted activity selection for snapshots and exports. Unknown future event kinds
-- are denied until intentionally assigned a permission; task events stay private to their owner.
create function private.admin_visible_activity() returns table(id uuid,action text,resource_id uuid,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin_permission('activity.read');
 return query
 select e.id,e.action,e.resource_id,e.created_at from private.admin_events e
 where (e.owner_id=auth.uid() and e.action in ('task_create','task_update','task_delete','tasks_reorder','preferences_update'))
    or (e.owner_id is null and e.action in ('contact_resolved','contact_reopened') and private.admin_has_permission('contacts.read'))
 union all
 select o.id,o.action,o.resource_id,o.created_at from public.operator_actions o
 where (o.action in ('contact_resolved','contact_reopened') and private.admin_has_permission('contacts.read'))
    or (o.action in ('review_claimed','review_checks','review_published','review_rejected','review_changes_requested') and private.is_reviewer())
 union all
 select a.id,a.action,a.target_id,a.created_at from private.admin_access_events a where private.admin_has_permission('access.manage')
 union all
 select x.id,'data_exported_'||x.resource,x.id,x.created_at from private.admin_export_events x
 where x.actor_id=auth.uid() and private.admin_has_permission('data.export');
end $$;

create or replace function private.admin_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; actor_role text; permissions text[]; access_data jsonb;
begin
 perform private.require_admin_permission('overview.read');
 select a.role,private.admin_role_permissions(a.role) into actor_role,permissions from private.platform_admins a where a.user_id=auth.uid();
 result:=private.admin_snapshot_before_roles();
 result:=jsonb_set(result,'{viewer}',result->'viewer'||jsonb_build_object('role',actor_role,'permissions',permissions));
 if not private.admin_has_permission('contacts.read') then
  result:=jsonb_set(result,'{contacts}','[]');
  result:=jsonb_set(result,'{totals,contacts}','0');
 end if;
 result:=jsonb_set(result,'{activity}',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select id,action,resource_id "resourceId",created_at "createdAt" from private.admin_visible_activity() order by created_at desc,id limit 100)e));
 result:=jsonb_set(result,'{totals,activity}',to_jsonb((select count(*) from private.admin_visible_activity())));
 if private.admin_has_permission('access.manage') then
  select jsonb_build_object(
   'revision',(select revision from private.admin_access_state where singleton),
   'members',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select a.user_id "userId",u.email,a.role,a.granted_at "grantedAt",a.updated_at "updatedAt" from private.platform_admins a join auth.users u on u.id=a.user_id order by a.granted_at,a.user_id limit 500)a),
   'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select id,actor_email "actorEmail",target_email "targetEmail",action,previous_role "previousRole",role,reason,created_at "createdAt" from private.admin_access_events order by created_at desc,id limit 100)e),
   'truncated',(select count(*)>500 from private.platform_admins) or (select count(*)>100 from private.admin_access_events)
  ) into access_data;
 end if;
 return result||jsonb_build_object('access',access_data);
end $$;
create or replace function public.admin_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_snapshot()$$;

create function private.admin_access_mutate(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare command text; allowed text[]; target_id uuid; target_email text; target_confirmed timestamptz; previous_role text; desired_role text; note text; current_revision integer; actor_email text;
begin
 perform private.require_admin_permission('access.manage');
 if input is null or jsonb_typeof(input) is distinct from 'object' or octet_length(input::text)>10000 then raise exception 'INVALID';end if;
 command:=input->>'action';
 allowed:=case command when 'access.grant' then array['action','email','role','reason','accessRevision'] when 'access.change' then array['action','userId','role','reason','accessRevision'] when 'access.revoke' then array['action','userId','reason','accessRevision'] else null end;
 if allowed is null or not input ?& allowed or exists(select 1 from jsonb_object_keys(input) k where not k=any(allowed)) then raise exception 'INVALID';end if;
 if jsonb_typeof(input->'reason') is distinct from 'string' or length(trim(input->>'reason')) not between 10 and 500 or jsonb_typeof(input->'accessRevision') is distinct from 'number' or input->>'accessRevision'!~'^[0-9]{1,9}$' then raise exception 'INVALID';end if;
 note:=trim(input->>'reason');
 if command in ('access.grant','access.change') then
  if jsonb_typeof(input->'role') is distinct from 'string' or input->>'role' not in ('owner','admin','operator','analyst') then raise exception 'INVALID';end if;
  desired_role:=input->>'role';
 end if;
 if command='access.grant' then
  if jsonb_typeof(input->'email') is distinct from 'string' or length(trim(input->>'email')) not between 3 and 254 or trim(input->>'email')!~'^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' then raise exception 'INVALID';end if;
 else
  if jsonb_typeof(input->'userId') is distinct from 'string' or input->>'userId'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID';end if;
  target_id:=(input->>'userId')::uuid;
 end if;
 -- Serialize the entire access directory, then recheck the caller after waiting.
 select revision into current_revision from private.admin_access_state where singleton for update;
 perform private.lock_admin_permission('access.manage');
 if current_revision<>(input->>'accessRevision')::integer then raise exception 'CONFLICT';end if;
 if command='access.grant' then
  if (select count(*) from auth.users u where lower(u.email)=lower(trim(input->>'email')))<>1 then raise exception 'USER_NOT_FOUND';end if;
  select u.id,u.email,u.email_confirmed_at into target_id,target_email,target_confirmed from auth.users u where lower(u.email)=lower(trim(input->>'email')) for share;
  if target_confirmed is null then raise exception 'EMAIL_UNCONFIRMED';end if;
  if not private.admin_user_is_active(target_id) then raise exception 'USER_INACTIVE';end if;
 else
  select u.email,u.email_confirmed_at into target_email,target_confirmed from auth.users u where u.id=target_id for share;
 end if;
 if target_id=auth.uid() then raise exception 'SELF_ACCESS_CHANGE';end if;
 select a.role into previous_role from private.platform_admins a where a.user_id=target_id for update;
 if command='access.grant' then
  if previous_role is not null then raise exception 'ALREADY_GRANTED';end if;
  if (select count(*) from private.platform_admins)>=500 then raise exception 'LIMIT_REACHED';end if;
  insert into private.platform_admins(user_id,role) values(target_id,desired_role);
 else
  if previous_role is null then raise exception 'NOT_FOUND';end if;
  if previous_role='owner' and (command='access.revoke' or desired_role<>'owner') and (select count(*) from private.platform_admins where role='owner')<=1 then raise exception 'LAST_OWNER';end if;
  if command='access.change' then
   if target_confirmed is null then raise exception 'EMAIL_UNCONFIRMED';end if;
   if not private.admin_user_is_active(target_id) then raise exception 'USER_INACTIVE';end if;
   if previous_role=desired_role then raise exception 'CONFLICT';end if;
   update private.platform_admins set role=desired_role where user_id=target_id;
  else delete from private.platform_admins where user_id=target_id;end if;
 end if;
 select email into actor_email from auth.users where id=auth.uid();
 insert into private.admin_access_events(actor_id,target_id,actor_email,target_email,action,previous_role,role,reason)
 values(auth.uid(),target_id,actor_email,target_email,case command when 'access.grant' then 'access_granted' when 'access.change' then 'access_changed' else 'access_revoked' end,previous_role,desired_role,note);
 update private.admin_access_state set revision=revision+1 where singleton;
 return private.admin_snapshot();
end $$;

create or replace function private.admin_mutate(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare command text;
begin
 perform private.require_admin();
 if input is null or jsonb_typeof(input) is distinct from 'object' then raise exception 'INVALID';end if;
 command:=input->>'action';
 if command in ('access.grant','access.change','access.revoke') then return private.admin_access_mutate(input);end if;
 if command in ('task.create','task.update','task.delete','tasks.reorder') then perform private.lock_admin_permission('tasks.manage');
 elsif command='contact.resolve' then perform private.lock_admin_permission('contacts.manage');
 elsif command='preferences.update' then perform private.lock_admin_permission(null);
 else raise exception 'INVALID';end if;
 return private.admin_mutate_before_roles(input);
end $$;
create or replace function public.admin_mutate(input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.admin_mutate(input)$$;

create function private.admin_export(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare resource text; rows jsonb; total bigint; row_limit integer:=5000; result jsonb;
begin
 perform private.lock_admin_permission('data.export');
 if input is null or jsonb_typeof(input) is distinct from 'object' then raise exception 'INVALID';end if;
 if not input ? 'resource' or jsonb_typeof(input->'resource') is distinct from 'string' or exists(select 1 from jsonb_object_keys(input) k where k<>'resource') then raise exception 'INVALID';end if;
 resource:=input->>'resource';
 if resource='overview' then
  perform private.require_admin_permission('overview.read');
  select coalesce(jsonb_agg(jsonb_build_object('name',e.key,'value',e.value) order by e.key),'[]') into rows from jsonb_each(private.admin_snapshot()->'stats') e;total:=jsonb_array_length(rows);
 elsif resource='companies' then
  perform private.require_admin_permission('catalog.read');
  select coalesce(jsonb_agg(to_jsonb(c)),'[]') into rows from (select organization_id id,display_name name,country_code country,city,coalesce(public_details->>'verification','unverified') "verificationStatus",published_at "publishedAt",withdrawn_at "withdrawnAt",(select count(*) from public.published_products p where p.organization_id=s.organization_id and p.withdrawn_at is null) "productCount" from public.published_supplier_profiles s order by published_at desc,organization_id limit row_limit)c;
  select count(*) into total from public.published_supplier_profiles;
 elsif resource='products' then
  perform private.require_admin_permission('catalog.read');
  select coalesce(jsonb_agg(to_jsonb(p)),'[]') into rows from (select p.product_id id,p.organization_id "companyId",c.display_name "companyName",p.name,p.category,p.published_at "publishedAt",coalesce(p.withdrawn_at,c.withdrawn_at) "withdrawnAt",coalesce(p.specifications->>'verification','unverified') "verificationStatus" from public.published_products p join public.published_supplier_profiles c on c.organization_id=p.organization_id order by p.published_at desc,p.product_id limit row_limit)p;
  select count(*) into total from public.published_products p join public.published_supplier_profiles c on c.organization_id=p.organization_id;
 elsif resource='contacts' then
  perform private.require_admin_permission('contacts.read');
  select coalesce(jsonb_agg(to_jsonb(c)),'[]') into rows from (select id,name,email,subject,body,language,created_at "createdAt",resolved_at "resolvedAt" from public.contact_requests order by (resolved_at is not null),created_at desc,id limit row_limit)c;
  select count(*) into total from public.contact_requests;
 elsif resource='activity' then
  perform private.require_admin_permission('activity.read');
  select coalesce(jsonb_agg(to_jsonb(a)),'[]') into rows from (select id,action,resource_id "resourceId",created_at "createdAt" from private.admin_visible_activity() order by created_at desc,id limit row_limit)a;
  select count(*) into total from private.admin_visible_activity();
 elsif resource='tasks' then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into rows from (select id,title,description,status,priority,due_date "dueDate",position,created_at "createdAt",updated_at "updatedAt" from private.admin_tasks where owner_id=auth.uid() order by position,id limit row_limit)t;
  select count(*) into total from private.admin_tasks where owner_id=auth.uid();
 else raise exception 'INVALID';end if;
 result:=jsonb_build_object('resource',resource,'rows',rows,'generatedAt',now(),'truncated',total>row_limit,'rowLimit',row_limit);
 insert into private.admin_export_events(actor_id,resource,row_count,truncated) values(auth.uid(),resource,jsonb_array_length(rows),total>row_limit);
 return result;
end $$;
create function public.admin_export(input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.admin_export(input)$$;

revoke all on function private.admin_user_is_active(uuid),private.lock_admin_permission(text),private.admin_role_permissions(text),private.admin_has_permission(text),private.require_admin_permission(text),private.admin_audit_immutable(),private.guard_last_admin_owner(),private.admin_visible_activity(),private.admin_access_mutate(jsonb),private.admin_export(jsonb),public.admin_export(jsonb),private.admin_snapshot(),private.admin_mutate(jsonb) from public,anon,authenticated;
grant execute on function private.admin_snapshot(),private.admin_mutate(jsonb),private.admin_export(jsonb),public.admin_export(jsonb) to authenticated;
