-- Controlled, one-time server operation. This is deliberately NOT a migration,
-- function, trigger or email allowlist, and grants nothing to a future account.
-- The caller must BEGIN a transaction, supply all three values with SET LOCAL
-- (or set_config(..., true)), execute this file, inspect the result, then COMMIT.
-- Required settings: gsl.owner_grant_user_id, gsl.owner_grant_email,
-- gsl.owner_grant_reason (10–500 characters describing the authorization).
-- The nil UUID is the reserved server-operation audit actor, never the target
-- user or a claim that the beneficiary performed an authenticated self-service action.
do $operation$
declare
 requested_id text := nullif(trim(current_setting('gsl.owner_grant_user_id', true)), '');
 requested_email text := nullif(trim(current_setting('gsl.owner_grant_email', true)), '');
 authorization_reason text := nullif(trim(current_setting('gsl.owner_grant_reason', true)), '');
 target_id uuid;
 target_email text;
 target_confirmed timestamptz;
 previous_role text;
 reviewer_added integer;
 server_actor constant uuid := '00000000-0000-0000-0000-000000000000';
begin
 if current_user in ('anon', 'authenticated', 'service_role') then
  raise exception 'SERVER_OPERATION_REQUIRED';
 end if;
 if requested_id is null or requested_email is null or authorization_reason is null then
  raise exception 'OWNER_GRANT_CONFIG_REQUIRED';
 end if;
 if requested_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or length(requested_email) not between 3 and 254
    or requested_email !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'
    or length(authorization_reason) not between 10 and 500 then
  raise exception 'OWNER_GRANT_CONFIG_INVALID';
 end if;
 target_id := requested_id::uuid;
 if target_id = server_actor then raise exception 'OWNER_GRANT_IDENTITY_MISMATCH'; end if;

 -- Same lock order as dashboard access changes. Account and existing grant stay
 -- locked until the caller's transaction ends, including any subsequent checks.
 perform 1 from private.admin_access_state where singleton for update;
 if not found then raise exception 'OWNER_GRANT_NOT_CONFIGURED'; end if;
 select u.email, u.email_confirmed_at into target_email, target_confirmed
 from auth.users u where u.id = target_id for share;
 if not found then raise exception 'OWNER_GRANT_USER_NOT_FOUND'; end if;
 if lower(trim(target_email)) is distinct from lower(requested_email)
    or (select count(*) from auth.users u where lower(trim(u.email)) = lower(requested_email)) <> 1 then
  raise exception 'OWNER_GRANT_IDENTITY_MISMATCH';
 end if;
 if target_confirmed is null then raise exception 'EMAIL_UNCONFIRMED'; end if;
 if not private.admin_user_is_active(target_id) then raise exception 'USER_INACTIVE'; end if;

 select a.role into previous_role from private.platform_admins a where a.user_id = target_id for update;
 if previous_role is distinct from 'owner' then
  if previous_role is null then
   if (select count(*) from private.platform_admins) >= 500 then raise exception 'LIMIT_REACHED'; end if;
   insert into private.platform_admins(user_id, role) values(target_id, 'owner');
  else
   update private.platform_admins set role = 'owner' where user_id = target_id;
  end if;
  insert into private.admin_access_events(actor_id, target_id, actor_email, target_email, action, previous_role, role, reason)
  values(server_actor, target_id, 'server-operation:grant-platform-owner', target_email,
   case when previous_role is null then 'access_granted' else 'access_changed' end,
   previous_role, 'owner', authorization_reason);
  update private.admin_access_state set revision = revision + 1 where singleton;
 end if;

 insert into private.platform_reviewers(user_id) values(target_id) on conflict(user_id) do nothing;
 get diagnostics reviewer_added = row_count;
 if reviewer_added > 0 then
  insert into public.operator_actions(actor_id, action, resource_id)
  values(server_actor, 'server_operation_reviewer_access_granted', target_id);
 end if;
end
$operation$;
