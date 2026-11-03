-- Open supplier registration and publication to Europe (owner decision, 3 November 2026).
-- Every policy and trigger calls public.gsl_sourcing_country, so widening the list here is enough.
-- Kept: the 10 partner countries. Added: EU, EEA, Switzerland, United Kingdom, Ukraine, Montenegro,
-- Kosovo and the microstates. Belarus and Russia stay out (EU restrictive measures).
-- Must match supplierCountries in lib/sourcing-coverage.ts. No row is created, changed or deleted.
create or replace function public.gsl_sourcing_country(code text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(code=any(array[
  'TR','MA','TN','RS','MK','BA','MD','GE','AL','EG',
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
  'NO','IS','LI','CH','GB','UA','ME','XK','AD','SM','MC'
 ]),false)
$$;
revoke all on function public.gsl_sourcing_country(text) from public;
grant execute on function public.gsl_sourcing_country(text) to anon,authenticated;
