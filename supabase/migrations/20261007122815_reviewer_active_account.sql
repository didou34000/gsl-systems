-- Reviewer grants follow the same live confirmed/active-account gate as administrators.
-- Keep the separate UUID grant and AAL2 requirement; no account is granted here.
create or replace function private.is_reviewer() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
  and coalesce(auth.jwt()->>'aal','aal1')='aal2'
  and private.admin_user_is_active(auth.uid())
  and exists(select 1 from private.platform_reviewers r where r.user_id=auth.uid());
$$;
