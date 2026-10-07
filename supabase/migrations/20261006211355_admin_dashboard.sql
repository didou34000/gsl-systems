-- Separate platform administration from supplier-document review. No account is granted here.
create table private.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_at timestamptz not null default now()
);
create table private.admin_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision integer not null default 0 check(revision>=0),
 widget_order jsonb not null default '["activity","tasks","contacts","catalog"]'
);
create table private.admin_tasks (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 140),
 description text not null default '' check(length(description)<=3000),
 status text not null default 'todo' check(status in ('todo','in_progress','done')),
 priority text not null default 'medium' check(priority in ('low','medium','high')),
 due_date date,
 position integer not null check(position>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index admin_tasks_owner on private.admin_tasks(owner_id,position,id);
create table private.admin_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,
 owner_id uuid,
 action text not null,
 resource_id uuid not null,
 created_at timestamptz not null default now()
);
create index admin_events_recent on private.admin_events(created_at desc,id);
alter table private.platform_admins enable row level security;
alter table private.admin_workspaces enable row level security;
alter table private.admin_tasks enable row level security;
alter table private.admin_events enable row level security;
revoke all on private.platform_admins,private.admin_workspaces,private.admin_tasks,private.admin_events from public,anon,authenticated;

create function private.admin_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare is_admin boolean; has_review boolean; has_mfa boolean;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select exists(select 1 from private.platform_admins a join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and u.email_confirmed_at is not null) into is_admin;
 select exists(select 1 from private.platform_reviewers where user_id=auth.uid()) into has_review;
 has_mfa:=coalesce(auth.jwt()->>'aal','aal1')='aal2';
 return jsonb_build_object('isAdmin',is_admin,'canReview',has_review and has_mfa,'mfaRequired',is_admin and not has_mfa);
end $$;
create function public.admin_access() returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_access()$$;

create function private.require_admin() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if not exists(select 1 from private.platform_admins a join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'ADMIN_REQUIRED';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
end $$;

create function private.admin_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin();
 return jsonb_build_object(
 'viewer',(select jsonb_build_object('id',u.id,'email',u.email,'reviewer',private.is_reviewer()) from auth.users u where u.id=auth.uid()),
 'generatedAt',now(),
 'stats',jsonb_build_object(
   'users',(select count(*) from auth.users),
   'companies',(select count(*) from public.organizations),
   'publishedCompanies',(select count(*) from public.published_supplier_profiles where withdrawn_at is null),
   'products',(select count(*) from public.products),
   'publishedProducts',(select count(*) from public.published_products p join public.published_supplier_profiles c on c.organization_id=p.organization_id where p.withdrawn_at is null and c.withdrawn_at is null),
   'openContacts',(select count(*) from public.contact_requests where resolved_at is null),
   'pendingApplications',(select count(*) from public.supplier_applications where status in ('submitted','in_review')),
   'pendingEmails',(select count(*) from public.notification_outbox where state in ('pending','processing')),
   'failedEmails',(select count(*) from public.notification_outbox where state='failed'),
   'conversations',(select count(*) from public.product_conversations)+(select count(*) from public.threads)),
 'trend',(select jsonb_agg(jsonb_build_object('date',d.day::date,'companies',coalesce(o.n,0),'products',coalesce(p.n,0),'contacts',coalesce(c.n,0)) order by d.day)
   from generate_series((now() at time zone 'UTC')::date-29,(now() at time zone 'UTC')::date,interval '1 day') d(day)
   left join (select (created_at at time zone 'UTC')::date as day,count(*) n from public.organizations where created_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC') group by 1)o on o.day=d.day::date
   left join (select (created_at at time zone 'UTC')::date as day,count(*) n from public.products where created_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC') group by 1)p on p.day=d.day::date
   left join (select (created_at at time zone 'UTC')::date as day,count(*) n from public.contact_requests where created_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC') group by 1)c on c.day=d.day::date),
 'companies',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (select organization_id id,display_name name,country_code country,city,coalesce(public_details->>'verification','unverified') "verificationStatus",published_at "publishedAt",withdrawn_at "withdrawnAt",(select count(*) from public.published_products p where p.organization_id=s.organization_id and p.withdrawn_at is null) "productCount" from public.published_supplier_profiles s order by published_at desc,organization_id limit 1000)c),
 'products',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from (select p.product_id id,p.organization_id "companyId",c.display_name "companyName",p.name,p.category,p.published_at "publishedAt",coalesce(p.withdrawn_at,c.withdrawn_at) "withdrawnAt",coalesce(p.specifications->>'verification','unverified') "verificationStatus" from public.published_products p join public.published_supplier_profiles c on c.organization_id=p.organization_id order by p.published_at desc,p.product_id limit 1000)p),
 'contacts',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (select id,name,email,subject,body,language,created_at "createdAt",resolved_at "resolvedAt" from public.contact_requests order by (resolved_at is not null),created_at desc,id limit 500)c),
 'activity',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select id,action,resource_id "resourceId",created_at "createdAt" from (select id,action,resource_id,created_at from private.admin_events where owner_id is null or owner_id=auth.uid() union all select id,action,resource_id,created_at from public.operator_actions) e order by created_at desc,id limit 100)a),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select id,title,description,status,priority,due_date "dueDate",position,created_at "createdAt",updated_at "updatedAt" from private.admin_tasks where owner_id=auth.uid() order by position,id)t),
 'preferences',jsonb_build_object('widgetOrder',coalesce((select widget_order from private.admin_workspaces where user_id=auth.uid()),'["activity","tasks","contacts","catalog"]'::jsonb)),
 'revision',coalesce((select revision from private.admin_workspaces where user_id=auth.uid()),0),
 'limits',jsonb_build_object('companies',1000,'products',1000,'contacts',500,'activity',100),
 'totals',jsonb_build_object('companies',(select count(*) from public.published_supplier_profiles),'products',(select count(*) from public.published_products p join public.published_supplier_profiles c on c.organization_id=p.organization_id),'contacts',(select count(*) from public.contact_requests),'activity',(select count(*) from private.admin_events where owner_id is null or owner_id=auth.uid())+(select count(*) from public.operator_actions))
 );
end $$;
create function public.admin_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_snapshot()$$;

create function private.admin_mutate(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare command text; current_revision integer; task_id uuid; deadline date; previous_resolution timestamptz; desired_resolution boolean; expected_resolution timestamptz; item jsonb; allowed_keys text[];
begin
 perform private.require_admin();
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>100000 then raise exception 'INVALID';end if;
 command:=input->>'action';
 allowed_keys:=case command
   when 'task.create' then array['action','revision','id','title','description','status','priority','dueDate']
   when 'task.update' then array['action','revision','id','title','description','status','priority','dueDate']
   when 'task.delete' then array['action','revision','id']
   when 'tasks.reorder' then array['action','revision','tasks']
   when 'preferences.update' then array['action','revision','widgetOrder']
   when 'contact.resolve' then array['action','id','resolved','expectedResolvedAt']
   else null end;
 if allowed_keys is null or exists(select 1 from jsonb_object_keys(input) k where not k=any(allowed_keys)) or not input ?& allowed_keys then raise exception 'INVALID';end if;
 if command in ('task.create','task.update','task.delete','contact.resolve') then
   if jsonb_typeof(input->'id')<>'string' or input->>'id'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID';end if;
   task_id:=(input->>'id')::uuid;
 end if;
 if command='contact.resolve' then
   if jsonb_typeof(input->'resolved')<>'boolean' or jsonb_typeof(input->'expectedResolvedAt') not in ('string','null') then raise exception 'INVALID';end if;
   desired_resolution:=(input->>'resolved')::boolean;
   begin expected_resolution:=(input->>'expectedResolvedAt')::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'INVALID';end;
   select resolved_at into previous_resolution from public.contact_requests where id=task_id for update;
   if not found then raise exception 'NOT_FOUND';end if;
   if previous_resolution is distinct from expected_resolution then raise exception 'CONFLICT';end if;
   if (previous_resolution is not null) is distinct from desired_resolution then
     update public.contact_requests set resolved_at=case when desired_resolution then now() else null end where id=task_id;
     insert into private.admin_events(actor_id,action,resource_id) values(auth.uid(),case when desired_resolution then 'contact_resolved' else 'contact_reopened' end,task_id);
   end if;
   return private.admin_snapshot();
 end if;
 if jsonb_typeof(input->'revision')<>'number' or input->>'revision'!~'^[0-9]{1,9}$' then raise exception 'INVALID';end if;
 insert into private.admin_workspaces(user_id) values(auth.uid()) on conflict do nothing;
 select revision into current_revision from private.admin_workspaces where user_id=auth.uid() for update;
 if current_revision<>(input->>'revision')::integer then raise exception 'CONFLICT';end if;
 if command in ('task.create','task.update') then
   if jsonb_typeof(input->'title')<>'string' or length(trim(input->>'title')) not between 1 and 140 or jsonb_typeof(input->'description')<>'string' or length(input->>'description')>3000 or coalesce(input->>'status','') not in ('todo','in_progress','done') or coalesce(input->>'priority','') not in ('low','medium','high') or jsonb_typeof(input->'dueDate') not in ('string','null') then raise exception 'INVALID';end if;
   if input->>'dueDate' is not null then
     if input->>'dueDate'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'INVALID';end if;
     begin deadline:=(input->>'dueDate')::date;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'INVALID';end;
   end if;
 end if;
 if command='task.create' then
   if (select count(*) from private.admin_tasks where owner_id=auth.uid())>=250 then raise exception 'LIMIT_REACHED';end if;
   if exists(select 1 from private.admin_tasks where id=task_id) then raise exception 'CONFLICT';end if;
   insert into private.admin_tasks(id,owner_id,title,description,status,priority,due_date,position)
     values(task_id,auth.uid(),trim(input->>'title'),input->>'description',input->>'status',input->>'priority',deadline,coalesce((select max(position)+1 from private.admin_tasks where owner_id=auth.uid()),0));
 elsif command='task.update' then
   update private.admin_tasks set title=trim(input->>'title'),description=input->>'description',status=input->>'status',priority=input->>'priority',due_date=deadline,updated_at=now() where id=task_id and owner_id=auth.uid();
   if not found then raise exception 'NOT_FOUND';end if;
 elsif command='task.delete' then
   delete from private.admin_tasks where id=task_id and owner_id=auth.uid();
   if not found then raise exception 'NOT_FOUND';end if;
 elsif command='tasks.reorder' then
   if jsonb_typeof(input->'tasks')<>'array' or jsonb_array_length(input->'tasks')>250 then raise exception 'INVALID';end if;
   for item in select value from jsonb_array_elements(input->'tasks') loop
     if jsonb_typeof(item)<>'object' or not item ?& array['id','status'] or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','status')) or coalesce(item->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(item->>'status','') not in ('todo','in_progress','done') then raise exception 'INVALID';end if;
   end loop;
   if (select count(*) from private.admin_tasks where owner_id=auth.uid())<>jsonb_array_length(input->'tasks') or (select count(distinct (value->>'id')::uuid) from jsonb_array_elements(input->'tasks'))<>jsonb_array_length(input->'tasks') or exists(select 1 from jsonb_array_elements(input->'tasks') j where not exists(select 1 from private.admin_tasks t where t.owner_id=auth.uid() and t.id=(j.value->>'id')::uuid)) then raise exception 'CONFLICT';end if;
   update private.admin_tasks t set position=(j.ordinality-1)::integer,status=j.value->>'status',updated_at=now() from jsonb_array_elements(input->'tasks') with ordinality j where t.owner_id=auth.uid() and t.id=(j.value->>'id')::uuid;
 elsif command='preferences.update' then
   if jsonb_typeof(input->'widgetOrder')<>'array' or jsonb_array_length(input->'widgetOrder')<>4 or (select count(distinct value) from jsonb_array_elements_text(input->'widgetOrder'))<>4 or exists(select 1 from jsonb_array_elements(input->'widgetOrder') j where jsonb_typeof(j.value)<>'string' or j.value#>>'{}' not in ('activity','tasks','contacts','catalog')) then raise exception 'INVALID';end if;
   update private.admin_workspaces set widget_order=input->'widgetOrder' where user_id=auth.uid();
 end if;
 update private.admin_workspaces set revision=revision+1 where user_id=auth.uid();
 insert into private.admin_events(actor_id,owner_id,action,resource_id) values(auth.uid(),auth.uid(),replace(command,'.','_'),coalesce(task_id,auth.uid()));
 return private.admin_snapshot();
end $$;
create function public.admin_mutate(input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.admin_mutate(input)$$;

revoke all on function private.admin_access(),public.admin_access(),private.require_admin(),private.admin_snapshot(),public.admin_snapshot(),private.admin_mutate(jsonb),public.admin_mutate(jsonb) from public,anon,authenticated;
grant execute on function private.admin_access(),public.admin_access(),private.admin_snapshot(),public.admin_snapshot(),private.admin_mutate(jsonb),public.admin_mutate(jsonb) to authenticated;
