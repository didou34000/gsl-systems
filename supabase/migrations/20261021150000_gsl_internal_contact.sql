-- Public profiles advertise GSL messaging only. Originals remain in private
-- supplier applications and in the organization's member-only website field.
create function private.keep_supplier_contact_private() returns trigger
language plpgsql set search_path='' as $$
begin
 new.public_details:=coalesce(new.public_details,'{}'::jsonb)-'referenceContact'-'website';
 return new;
end $$;
revoke all on function private.keep_supplier_contact_private() from public,anon,authenticated;
create trigger supplier_contact_private before insert or update of public_details
on public.published_supplier_profiles for each row execute function private.keep_supplier_contact_private();
update public.published_supplier_profiles set public_details=public_details-'referenceContact'-'website'
where public_details ?| array['referenceContact','website'];

-- The five documentary entries have public slugs, not supplier accounts.
-- Lazily create a GSL-managed messaging recipient for a known entry. This does
-- not register the manufacturer, grant the visitor membership, or admit offers.
create function private.referenced_messaging_target(reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid(); target uuid; company_name text; country text; city text; source text; source_url text;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null)
 then raise exception 'LOGIN_REQUIRED';end if;
 select id,name,country_code,location,source_id,website into target,company_name,country,city,source,source_url
 from (values
 ('repere-wat-motor','a5100000-0000-4000-8000-000000000901'::uuid,'WAT Motor','TR','Kapaklı (Tekirdağ)','F901','https://www.wat.com.tr'),
 ('repere-opkon','a5100000-0000-4000-8000-000000000902'::uuid,'OPKON','TR','Istanbul','F902','https://www.opkon.com.tr'),
 ('repere-cure-bionics','a5100000-0000-4000-8000-000000000903'::uuid,'Cure Bionics','TN','Sousse','F903','https://curebionics.com'),
 ('repere-acrome-robotics','a5100000-0000-4000-8000-000000000904'::uuid,'Acrome Robotics','TR','Istanbul','F904','https://acrome.net'),
 ('repere-akinrobotics','a5100000-0000-4000-8000-000000000905'::uuid,'AKINROBOTICS','TR','Konya','F905','https://www.akinrobotics.com')
 ) entries(slug,id,name,country_code,location,source_id,website) where slug=reference;
 if target is null then raise exception 'NOT_PUBLISHED';end if;
 perform pg_advisory_xact_lock(hashtextextended('referenced-messaging:'||reference,0));
 if exists(select 1 from private.curated_catalogue_companies where organization_id=target) then
  if not exists(select 1 from public.published_supplier_profiles where organization_id=target and withdrawn_at is null)
  then raise exception 'NOT_PUBLISHED';end if;
  return target;
 end if;
 if not exists(select 1 from private.platform_admins where role='owner' and private.admin_user_is_active(user_id))
 then raise exception 'UNAVAILABLE';end if;
 -- The normal organization trigger seeds the creator. Remove that membership
 -- atomically before the GSL owner synchronization: visitors acquire no rights.
 insert into public.organizations(id,created_by,legal_name,country_code,entity_kind,supplier)
 values(target,actor,company_name,country,'company',true);
 delete from public.memberships where organization_id=target and user_id=actor;
 insert into private.curated_catalogue_companies(organization_id,source_id,batch_id)
 values(target,source,'referenced-messaging-only');
 insert into public.published_supplier_profiles(organization_id,source_revision,display_name,country_code,city,description,public_details)
 values(target,1,company_name,country,city,'',jsonb_build_object('candidate',true,'verification','unverified','reference_slug',reference,'research',jsonb_build_object(
  'kind','gsl_research','schemaVersion',1,'sourceId',source,'checkedAt','2026-10-13',
  'sector','','family','','categories','[]'::jsonb,'productFamilies','','processes','',
  'certifications','','certificationStatus','Non vérifié par GSL','certificationDates','','evidenceLevel','N','europeanMarket','',
  'agreement',jsonb_build_object('code','','agreement','','date','','benefit','','proof','','limits','','sources','[]'::jsonb),
  'regulations','[]'::jsonb,'sources',jsonb_build_array(jsonb_build_object('url',source_url,'title',company_name||', documentation')))));
 return target;
end $$;
create function public.referenced_messaging_target(reference text) returns uuid
language sql security invoker set search_path='' as $$select private.referenced_messaging_target(reference)$$;
revoke all on function private.referenced_messaging_target(text),public.referenced_messaging_target(text) from public,anon;
grant execute on function private.referenced_messaging_target(text),public.referenced_messaging_target(text) to authenticated;
