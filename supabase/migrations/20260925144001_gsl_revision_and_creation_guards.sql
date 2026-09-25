-- The owner must exist before INSERT RETURNING evaluates its SELECT policy.
alter table public.memberships alter constraint memberships_organization_id_fkey deferrable initially deferred;
drop trigger seed_owner on public.organizations;
create trigger seed_owner before insert on public.organizations for each row execute function private.seed_owner();
drop policy rfq_read on public.rfqs;
create policy rfq_read on public.rfqs for select to authenticated using(private.is_member(organization_id,array['owner','admin','procurement']) or private.can_read_rfq(id));

-- A new document/address/site/capability must not silently retain a reviewed company snapshot.
create function private.invalidate_related_company() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authenticated change required'; end if;
  update public.organizations set updated_at=now() where id=new.organization_id;
  return new;
end; $$;
revoke execute on function private.invalidate_related_company() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['organization_identifiers','addresses','production_sites','organization_contacts','capabilities','media_links','evidence_documents','evidence_scopes','product_compliance_records'] loop
    execute format('create trigger invalidate_company after insert or update on public.%I for each row execute function private.invalidate_related_company()',t);
  end loop;
end $$;
