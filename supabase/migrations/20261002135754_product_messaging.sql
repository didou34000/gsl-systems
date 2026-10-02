-- Product enquiries are separate from RFQs: a buyer can ask a question before specifying a quantity.
create table public.product_conversations (
 id uuid primary key default gen_random_uuid(),
 buyer_organization_id uuid not null references public.organizations(id),
 supplier_organization_id uuid not null references public.organizations(id),
 product_id uuid not null references public.published_products(product_id),
 product_name text not null, buyer_name text not null, supplier_name text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(buyer_organization_id<>supplier_organization_id),
 unique(buyer_organization_id,supplier_organization_id,product_id)
);
create table public.product_messages (
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.product_conversations(id),
 sender_organization_id uuid not null references public.organizations(id),sender_user_id uuid not null references auth.users(id),
 body text not null check(length(trim(body)) between 1 and 10000),command_id uuid not null,
 created_at timestamptz not null default now(), unique(sender_user_id,command_id)
);
alter table public.product_conversations enable row level security;
alter table public.product_messages enable row level security;
revoke all on public.product_conversations,public.product_messages from public,anon,authenticated;
grant select on public.product_conversations,public.product_messages to authenticated;
create index product_conversation_buyer on public.product_conversations(buyer_organization_id,updated_at desc,id);
create index product_conversation_supplier on public.product_conversations(supplier_organization_id,updated_at desc,id);
create index product_message_history on public.product_messages(conversation_id,created_at desc,id desc);
create function private.can_read_product_conversation(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.product_conversations c where c.id=p_id and
 (private.is_member(c.buyer_organization_id,array['owner','admin','procurement']) or private.is_member(c.supplier_organization_id,array['owner','admin','sales'])))
$$;
revoke all on function private.can_read_product_conversation(uuid) from public,anon;
grant execute on function private.can_read_product_conversation(uuid) to authenticated;
create policy product_conversation_read on public.product_conversations for select to authenticated using(private.can_read_product_conversation(id));
create policy product_message_read on public.product_messages for select to authenticated using(private.can_read_product_conversation(conversation_id));
-- Elevated writes remain private, with explicit actor/organization/product checks before every write.
create function private.send_product_message(p_company uuid,p_product uuid,p_conversation uuid,p_body text,p_command uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid();c public.product_conversations;m public.product_messages;p public.published_products;s public.published_supplier_profiles;company public.organizations;
begin
 if actor is null then raise exception 'LOGIN_REQUIRED';end if;
 if p_company is null or p_command is null or p_body is null or length(trim(p_body)) not between 1 and 10000 or (p_product is null)=(p_conversation is null) then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_command::text,0));
 select * into m from public.product_messages where sender_user_id=actor and command_id=p_command;
 if m.id is not null then
  select * into c from public.product_conversations where id=m.conversation_id;
  if not private.can_read_product_conversation(c.id) then raise exception 'FORBIDDEN';end if;
  if m.sender_organization_id<>p_company or m.body<>trim(p_body) or (p_conversation is not null and c.id<>p_conversation) or (p_product is not null and c.product_id<>p_product) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('conversation',c.id,'message',m.id);
 end if;
 if p_product is not null then
  if not private.is_member(p_company,array['owner','admin','procurement']) then raise exception 'FORBIDDEN';end if;
  select * into company from public.organizations where id=p_company and buyer;
  if company.id is null then raise exception 'FORBIDDEN';end if;
  select * into p from public.published_products where product_id=p_product and withdrawn_at is null;
  select * into s from public.published_supplier_profiles where organization_id=p.organization_id and withdrawn_at is null;
  if p.product_id is null or s.organization_id is null then raise exception 'NOT_PUBLISHED';end if;
  if p.organization_id=p_company then raise exception 'OWN_PRODUCT';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_company::text||p.product_id::text,1));
  select * into c from public.product_conversations where buyer_organization_id=p_company and supplier_organization_id=p.organization_id and product_id=p_product;
  if c.id is null then
   insert into public.product_conversations(buyer_organization_id,supplier_organization_id,product_id,product_name,buyer_name,supplier_name)
   values(p_company,p.organization_id,p_product,p.name,company.legal_name,s.display_name) returning * into c;
  end if;
 else
  select * into c from public.product_conversations where id=p_conversation;
  if c.id is null or not ((p_company=c.buyer_organization_id and private.is_member(p_company,array['owner','admin','procurement'])) or (p_company=c.supplier_organization_id and private.is_member(p_company,array['owner','admin','sales']))) then raise exception 'FORBIDDEN';end if;
 end if;
 if (select count(*) from public.product_messages where sender_user_id=actor and created_at>now()-interval '1 minute')>=30 then raise exception 'RATE_LIMITED';end if;
 insert into public.product_messages(conversation_id,sender_organization_id,sender_user_id,body,command_id)
 values(c.id,p_company,actor,trim(p_body),p_command) returning * into m;
 update public.product_conversations set updated_at=m.created_at where id=c.id;
 return jsonb_build_object('conversation',c.id,'message',m.id);
end $$;
create function public.send_product_message(p_company uuid,p_product uuid,p_conversation uuid,p_body text,p_command uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.send_product_message(p_company,p_product,p_conversation,p_body,p_command)$$;
revoke all on function private.send_product_message(uuid,uuid,uuid,text,uuid),public.send_product_message(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function private.send_product_message(uuid,uuid,uuid,text,uuid),public.send_product_message(uuid,uuid,uuid,text,uuid) to authenticated;
