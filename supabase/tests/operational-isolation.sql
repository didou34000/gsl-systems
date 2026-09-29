-- Synthetic accounts: no network, emails or production writes.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','buyer-a@example.invalid'),
 ('00000000-0000-4000-8000-000000000002','buyer-b@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.supplier_applications(owner_id,payload) values(auth.uid(),'{"legalName":"Synthetic"}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 if exists(select 1 from public.supplier_applications) then raise exception 'Cross tenant application leak';end if;
end $$;
reset role;
