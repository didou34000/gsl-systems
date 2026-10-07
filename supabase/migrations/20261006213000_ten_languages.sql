-- Interface languages are persisted independently from the existing EN/FR email templates.
-- The notification_language trigger keeps its existing fallback for transactional mail.
alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles add constraint profiles_language_check
  check (language in ('en','fr','es','pt','de','it','tr','ar','hi','zh'));

-- Keep the contact's requested language for the administration inbox.
-- Transactional messages still use the existing English/French templates.
alter table public.contact_requests drop constraint if exists contact_requests_language_check;
alter table public.contact_requests add constraint contact_requests_language_check
  check (language in ('en','fr','es','pt','de','it','tr','ar','hi','zh'));

create or replace function private.submit_contact(request_id uuid,email text,name text,subject text,body text,language text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if request_id is null or length(email)>254 or email!~'^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' or length(trim(name)) not between 2 and 150 or length(trim(subject)) not between 3 and 150 or length(trim(body)) not between 20 and 5000 or language not in ('en','fr','es','pt','de','it','tr','ar','hi','zh') then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('gsl-contact-global',0));
 if exists(select 1 from public.contact_requests c where c.id=request_id) then
  if exists(select 1 from public.contact_requests c where c.id=request_id and c.email=lower(submit_contact.email) and c.body=submit_contact.body) then return request_id;end if;raise exception 'CONFLICT';end if;
 if (select count(*) from public.contact_requests where created_at>now()-interval '1 minute')>=30 or (select count(*) from public.contact_requests c where c.email=lower(submit_contact.email) and created_at>now()-interval '1 hour')>=3 then raise exception 'RATE_LIMITED';end if;
 insert into public.contact_requests(id,email,name,subject,body,language) values(request_id,lower(email),name,subject,body,language);
 insert into public.notification_outbox(event_key,recipient_email,template,resource_id,language) values('contact:'||request_id,lower(email),'contact_received',request_id,case when language='fr' then 'fr' else 'en' end),('contact-operator:'||request_id,'contact@gsl-systems.com','contact_operator',request_id,'fr');
 return request_id;
end $$;
