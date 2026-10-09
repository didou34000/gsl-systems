-- Commercial scope only. No existing profile, draft, order or message is deleted or rewritten.
create function public.gsl_sourcing_country(code text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(code=any(array['TR','MA','TN','RS','MK','BA','MD','GE','AL','EG']),false)
$$;
revoke all on function public.gsl_sourcing_country(text) from public;
grant execute on function public.gsl_sourcing_country(text) to anon,authenticated;

-- Apply to every public projection consumer, including direct REST, search, sitemap and saved selections.
alter policy supplier_public_read on public.published_supplier_profiles
 using (withdrawn_at is null and public.gsl_sourcing_country(country_code) and not exists(select 1 from unnest(manufacturing_countries) c where not public.gsl_sourcing_country(c)));
alter policy product_public_read on public.published_products
 using (withdrawn_at is null and public.gsl_sourcing_country(specifications->>'manufacturing_country') and exists(
  select 1 from public.published_supplier_profiles s where s.organization_id=published_products.organization_id and s.withdrawn_at is null
  and public.gsl_sourcing_country(s.country_code)
 ));

-- Publication RPCs run as definer; a trigger enforces the same rule even when RLS is bypassed.
create function private.enforce_sourcing_publication() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.withdrawn_at is not null then return new;end if;
 if tg_op='UPDATE' and new is not distinct from old then return new;end if;
 if tg_table_name='published_supplier_profiles' then
  if not public.gsl_sourcing_country(new.country_code) or exists(select 1 from unnest(new.manufacturing_countries) c where not public.gsl_sourcing_country(c)) then raise exception 'COUNTRY_OUTSIDE_SCOPE';end if;
 else
  -- Review creates products before the final supplier projection; validate their owning organization.
  -- Public visibility additionally requires the active, in-scope supplier projection above.
  if not public.gsl_sourcing_country(new.specifications->>'manufacturing_country') or not exists(
   select 1 from public.organizations s where s.id=new.organization_id and public.gsl_sourcing_country(s.country_code)
  ) then raise exception 'COUNTRY_OUTSIDE_SCOPE';end if;
 end if;
 return new;
end $$;
revoke all on function private.enforce_sourcing_publication() from public,anon,authenticated;
create trigger enforce_supplier_country before insert or update on public.published_supplier_profiles
 for each row execute function private.enforce_sourcing_publication();
create trigger enforce_product_country before insert or update on public.published_products
 for each row execute function private.enforce_sourcing_publication();

-- Incomplete/legacy drafts may still be saved. Submission cannot bypass the new country selectors.
create function private.enforce_sourcing_submission() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status<>'submitted' then return new;end if;
 if not public.gsl_sourcing_country(new.payload->>'country')
 or exists(select 1 from jsonb_array_elements(coalesce(new.payload->'sites','[]')) s where not public.gsl_sourcing_country(s#>>'{address,country}'))
 or exists(select 1 from jsonb_array_elements(coalesce(new.payload->'products','[]')) p where coalesce(p->>'listingStatus','publish')<>'draft' and not public.gsl_sourcing_country(p->>'origin'))
 then raise exception 'COUNTRY_OUTSIDE_SCOPE';end if;
 return new;
end $$;
revoke all on function private.enforce_sourcing_submission() from public,anon,authenticated;
create trigger enforce_supplier_submission_countries before insert or update on public.supplier_applications
 for each row execute function private.enforce_sourcing_submission();
