-- Allow contacting a published manufacturer without a product or a quote questionnaire.
alter table public.product_conversations alter column product_id drop not null;
create unique index company_direct_conversation on public.product_conversations(buyer_organization_id,supplier_organization_id) where product_id is null;
create function private.send_direct_message(p_company uuid,p_product uuid,p_supplier uuid,p_conversation uuid,p_body text,p_command uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid();c public.product_conversations;m public.product_messages;p public.published_products;s public.published_supplier_profiles;company public.organizations;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'LOGIN_REQUIRED';end if;
 if p_company is null or p_command is null or p_body is null or length(trim(p_body)) not between 1 and 10000 or num_nonnulls(p_product,p_supplier,p_conversation)<>1 then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_command::text,0));
 select * into m from public.product_messages where sender_user_id=actor and command_id=p_command;
 if m.id is not null then
  select * into c from public.product_conversations where id=m.conversation_id;
  if not private.can_read_product_conversation(c.id) then raise exception 'FORBIDDEN';end if;
  if m.sender_organization_id<>p_company or m.body<>trim(p_body) or (p_conversation is not null and c.id<>p_conversation) or (p_product is not null and c.product_id is distinct from p_product) or (p_supplier is not null and (c.supplier_organization_id<>p_supplier or c.product_id is not null)) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('conversation',c.id,'message',m.id);
 end if;
 if p_conversation is null then
  if not private.is_member(p_company,array['owner','admin','procurement']) then raise exception 'FORBIDDEN';end if;
  select * into company from public.organizations where id=p_company;
  if company.id is null then raise exception 'FORBIDDEN';end if;
  if p_product is not null then
  select * into p from public.published_products where product_id=p_product and withdrawn_at is null;
  select * into s from public.published_supplier_profiles where organization_id=p.organization_id and withdrawn_at is null;
  if p.product_id is null or s.organization_id is null then raise exception 'NOT_PUBLISHED';end if;
  else
   select * into s from public.published_supplier_profiles where organization_id=p_supplier and withdrawn_at is null;
   if s.organization_id is null then raise exception 'NOT_PUBLISHED';end if;
  end if;
  if s.organization_id=p_company then raise exception 'OWN_PRODUCT';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_company::text||s.organization_id::text||coalesce(p_product::text,'direct'),1));
  select * into c from public.product_conversations where buyer_organization_id=p_company and supplier_organization_id=s.organization_id and product_id is not distinct from p_product;
  if c.id is null then
   insert into public.product_conversations(buyer_organization_id,supplier_organization_id,product_id,product_name,buyer_name,supplier_name)
   values(p_company,s.organization_id,p_product,coalesce(p.name,'Contact direct'),company.legal_name,s.display_name) returning * into c;
  end if;
 else
  select * into c from public.product_conversations where id=p_conversation;
  if c.id is null or not ((p_company=c.buyer_organization_id and private.is_member(p_company,array['owner','admin','procurement'])) or (p_company=c.supplier_organization_id and private.is_member(p_company,array['owner','admin','sales']))) then raise exception 'FORBIDDEN';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(c.id::text,2));
 if (select count(*) from public.product_messages where sender_user_id=actor and created_at>now()-interval '1 minute')>=30 then raise exception 'RATE_LIMITED';end if;
 insert into public.product_messages(conversation_id,sender_organization_id,sender_user_id,body,command_id)
 values(c.id,p_company,actor,trim(p_body),p_command) returning * into m;
 update public.product_conversations set updated_at=m.created_at where id=c.id;
 return jsonb_build_object('conversation',c.id,'message',m.id);
end $$;

create function public.send_direct_message(p_company uuid,p_product uuid,p_supplier uuid,p_conversation uuid,p_body text,p_command uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.send_direct_message(p_company,p_product,p_supplier,p_conversation,p_body,p_command)$$;
revoke all on function private.send_direct_message(uuid,uuid,uuid,uuid,text,uuid),public.send_direct_message(uuid,uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function private.send_direct_message(uuid,uuid,uuid,uuid,text,uuid),public.send_direct_message(uuid,uuid,uuid,uuid,text,uuid) to authenticated;
-- Preserve compatibility with the existing product contact endpoint.
create or replace function private.send_product_message(p_company uuid,p_product uuid,p_conversation uuid,p_body text,p_command uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.send_direct_message(p_company,p_product,null,p_conversation,p_body,p_command)$$;

-- Track only messages actually displayed, so an arriving message cannot be marked read accidentally.
create table private.message_reads (
 user_id uuid not null references auth.users(id) on delete cascade,
 message_id uuid not null references public.product_messages(id) on delete cascade,
 primary key(user_id,message_id)
);
alter table private.message_reads enable row level security;
revoke all on private.message_reads from public,anon,authenticated;
create policy own_message_reads on private.message_reads for select to authenticated using(user_id=(select auth.uid()));
create function private.mark_messages_read(p_messages uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if coalesce(cardinality(p_messages),0)>50 then raise exception 'INVALID';end if;
 insert into private.message_reads(user_id,message_id)
 select auth.uid(),m.id from public.product_messages m where m.id=any(p_messages) and private.can_read_product_conversation(m.conversation_id)
 on conflict do nothing;
end $$;
create function public.mark_messages_read(p_messages uuid[]) returns void language sql security invoker set search_path='' as $$select private.mark_messages_read(p_messages)$$;
create function private.messaging_summary(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 if coalesce(cardinality(p_ids),0)>31 then raise exception 'INVALID';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'last_body',last_message.body,'unread',
 (select count(*) from public.product_messages m where m.conversation_id=c.id and m.sender_user_id<>auth.uid() and not exists(select 1 from private.message_reads r where r.user_id=auth.uid() and r.message_id=m.id))))
 from public.product_conversations c left join lateral(select body from public.product_messages where conversation_id=c.id order by created_at desc,id desc limit 1)last_message on true
 where c.id=any(p_ids) and private.can_read_product_conversation(c.id)),'[]');
end $$;
create function public.messaging_summary(p_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$select private.messaging_summary(p_ids)$$;
create function private.messaging_unread() returns bigint language sql stable security definer set search_path='' as $$
 select count(*) from public.product_messages m where auth.uid() is not null and m.sender_user_id<>auth.uid()
 and private.can_read_product_conversation(m.conversation_id)
 and not exists(select 1 from private.message_reads r where r.user_id=auth.uid() and r.message_id=m.id)
$$;
create function public.messaging_unread() returns bigint language sql security invoker set search_path='' as $$select private.messaging_unread()$$;
revoke all on function private.mark_messages_read(uuid[]),public.mark_messages_read(uuid[]),private.messaging_summary(uuid[]),public.messaging_summary(uuid[]),private.messaging_unread(),public.messaging_unread() from public,anon;
grant execute on function private.mark_messages_read(uuid[]),public.mark_messages_read(uuid[]),private.messaging_summary(uuid[]),public.messaging_summary(uuid[]),private.messaging_unread(),public.messaging_unread() to authenticated;
