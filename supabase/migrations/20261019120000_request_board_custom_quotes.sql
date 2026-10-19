-- Request board v2: buyers' custom quote requests, grouped by robotics family, ranked in the application.
-- Depends on (apply in this order): 20261012120000_robotics_selection.sql, 20261013130000_component_sourcing_delivery.sql,
-- 20261014120000_request_board.sql, then this file. Idempotent: it can be re-run safely.
-- Privacy: buyer company, contact, delivery address, free-text details and files are never returned by the board.
-- Sharing stays an explicit buyer choice stored per request (the form proposes it checked); it only shows once submitted to GSL.

alter table public.delivery_cases add column if not exists board_shared_at timestamptz;
alter table public.delivery_cases add column if not exists board_families text[] not null default '{}';
do $$begin
 if not exists(select 1 from pg_constraint where conname='delivery_cases_board_families_valid') then
  alter table public.delivery_cases add constraint delivery_cases_board_families_valid check(
   cardinality(board_families)<=8 and board_families <@ array['actionnement-transmission','transmissions-guidages','capteurs-vision','commande-electronique','cables-connecteurs','energie-batteries','prehension','pieces-mecaniques','autre']::text[]);
 end if;
end$$;

create table if not exists private.request_board_responses (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.delivery_cases(id),
 supplier_organization_id uuid not null references public.organizations(id),
 created_by uuid not null references auth.users(id),
 message text not null check(length(trim(message)) between 20 and 4000),
 lead_time text not null default '' check(length(lead_time)<=200),
 created_at timestamptz not null default now(),
 unique(case_id,supplier_organization_id)
);
alter table private.request_board_responses enable row level security;
revoke all on private.request_board_responses from public,anon,authenticated;

-- Share or withdraw, with families chosen by the buyer (or inferred from the title and lines by the application).
create or replace function private.set_request_board(case_uuid uuid,shared boolean,families text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.delivery_cases;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into c from public.delivery_cases where id=case_uuid for update;
 if c.id is null or not private.is_member(c.organization_id,array['owner','admin','procurement']) then raise exception 'FORBIDDEN';end if;
 if c.stage in ('cancelled','closed','delivered') then raise exception 'CONFLICT';end if;
 if shared is null or families is null or cardinality(families)>8 or not (families <@ array['actionnement-transmission','transmissions-guidages','capteurs-vision','commande-electronique','cables-connecteurs','energie-batteries','prehension','pieces-mecaniques','autre']::text[]) then raise exception 'INVALID';end if;
 if shared is distinct from (c.board_shared_at is not null) or families is distinct from c.board_families then
  update public.delivery_cases set board_shared_at=case when shared then coalesce(board_shared_at,now()) else null end,board_families=families,updated_at=now() where id=c.id;
  if shared is distinct from (c.board_shared_at is not null) then
   perform private.delivery_event(c.id,c.stage,case when shared then 'Résumé anonyme diffusé aux fabricants inscrits dès la transmission à GSL, sans identité, coordonnées, adresse, explications détaillées ni fichiers.' else 'Résumé retiré de la page des demandes.' end);
  end if;
 end if;
 return jsonb_build_object('id',c.id,'shared',shared,'families',to_jsonb(families));
end$$;
create or replace function public.set_request_board(case_uuid uuid,shared boolean,families text[]) returns jsonb language sql security invoker set search_path='' as $$select private.set_request_board(case_uuid,shared,families)$$;

-- Former entry point kept compatible; drafts may now record the choice in advance.
create or replace function private.share_request_on_board(case_uuid uuid,shared boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.delivery_cases;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into c from public.delivery_cases where id=case_uuid;
 if c.id is null or not private.is_member(c.organization_id,array['owner','admin','procurement']) then raise exception 'FORBIDDEN';end if;
 return private.set_request_board(case_uuid,shared,c.board_families);
end$$;
create or replace function public.share_request_on_board(case_uuid uuid,shared boolean) returns jsonb language sql security invoker set search_path='' as $$select private.share_request_on_board(case_uuid,shared)$$;

-- Rows only; ranking happens in app/api/request-board/route.ts (lib/request-board/ranking.ts).
create or replace function private.request_board() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare signed boolean;unlocked boolean;orgs uuid[];maker jsonb:=null;
begin
 signed:=auth.uid() is not null and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null);
 select array_agg(o.id) into orgs from public.memberships m join public.organizations o on o.id=m.organization_id where signed and m.user_id=auth.uid() and m.active and o.supplier;
 unlocked:=coalesce(cardinality(orgs),0)>0;
 if unlocked then
  maker:=jsonb_build_object(
   'organizations',(select jsonb_agg(jsonb_build_object('id',o.id,'name',coalesce(nullif(o.trading_name,''),o.legal_name),'country',o.country_code) order by o.legal_name) from public.organizations o where o.id=any(orgs)),
   'products',coalesce((select jsonb_agg(jsonb_build_object('category',p.category,'description',left(p.description,6000),
     'family',coalesce(pr.specifications->>'robotics_family',''),'minimum_quantity',coalesce(pr.specifications->>'minimum_quantity',''),'unit',coalesce(pr.specifications->>'unit',''),
     'lead_time',coalesce(pr.specifications->>'lead_time',''),'materials',coalesce(pr.specifications->>'materials',''),'processes',coalesce(pr.specifications->>'processes','')))
    from (select * from public.published_products where organization_id=any(orgs) and withdrawn_at is null order by published_at desc limit 200) p join public.products pr on pr.id=p.product_id),'[]'::jsonb),
   'processes',coalesce((select jsonb_agg(distinct x) from (select unnest(s.processes) x from public.published_supplier_profiles s where s.organization_id=any(orgs) union select c.process from public.capabilities c where c.organization_id=any(orgs)) t where coalesce(x,'')<>''),'[]'::jsonb),
   'materials',coalesce((select jsonb_agg(distinct x) from (select unnest(s.materials) x from public.published_supplier_profiles s where s.organization_id=any(orgs) union select unnest(c.materials) from public.capabilities c where c.organization_id=any(orgs)) t where coalesce(x,'')<>''),'[]'::jsonb),
   'moq',coalesce((select jsonb_agg(jsonb_build_object('quantity',c.minimum_quantity,'unit',c.quantity_unit)) from public.capabilities c where c.organization_id=any(orgs) and c.minimum_quantity is not null),'[]'::jsonb));
 end if;
 return jsonb_build_object('signedIn',signed,'unlocked',unlocked,'maker',maker,'requests',coalesce((select jsonb_agg(row order by row->>'shared_at' desc) from (
  select jsonb_build_object(
   'reference',c.reference,'shared_at',c.board_shared_at,'destination',c.delivery->>'country','deadline',coalesce(r.deadline,nullif(c.delivery->>'deadline','')::date),
   'lines',(select count(*) from public.rfq_items i where i.rfq_id=r.id),
   'total_quantity',(select sum(i.quantity) from public.rfq_items i where i.rfq_id=r.id),
   'families',(select coalesce(jsonb_agg(distinct f),'[]'::jsonb) from (select unnest(c.board_families) f union select p.category from public.rfq_items i join public.published_products p on p.product_id=i.selected_product_id where i.rfq_id=r.id and p.category=any(array['actionnement-transmission','transmissions-guidages','capteurs-vision','commande-electronique','cables-connecteurs','energie-batteries','prehension','pieces-mecaniques'])) t)
  )||case when unlocked then jsonb_build_object('title',r.title,
   'items',coalesce((select jsonb_agg(jsonb_build_object('description',i.description,'quantity',i.quantity,'unit',i.unit) order by i.id) from public.rfq_items i where i.rfq_id=r.id),'[]'::jsonb),
   'responded_at',(select max(x.created_at) from private.request_board_responses x where x.case_id=c.id and x.supplier_organization_id=any(orgs))) else '{}'::jsonb end as row
  from public.delivery_cases c join public.rfqs r on r.id=c.rfq_id
  where c.board_shared_at is not null and c.submitted_at is not null and c.stage not in ('cancelled','closed','delivered','accepted','production','ready','shipped')
  order by c.board_shared_at desc limit 200) s),'[]'::jsonb));
end$$;
create or replace function public.request_board() returns jsonb language sql stable security invoker set search_path='' as $$select private.request_board()$$;

-- A manufacturer member offers to quote. GSL relays it; the buyer sees an event without the manufacturer's contact details.
create or replace function private.respond_to_board_request(request_reference text,organization uuid,message text,lead_time text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.delivery_cases;rid uuid;
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'LOGIN_REQUIRED';end if;
 if not private.is_member(organization,array['owner','admin','sales']) or not exists(select 1 from public.organizations where id=organization and supplier) then raise exception 'FORBIDDEN';end if;
 if length(trim(coalesce(message,''))) not between 20 and 4000 or length(coalesce(lead_time,''))>200 then raise exception 'INVALID';end if;
 select * into c from public.delivery_cases where reference=request_reference and board_shared_at is not null and submitted_at is not null and stage in ('received','qualification','quote_preparation','proposed');
 if c.id is null then raise exception 'NOT_FOUND';end if;
 if c.organization_id=organization then raise exception 'FORBIDDEN';end if;
 insert into private.request_board_responses(case_id,supplier_organization_id,created_by,message,lead_time) values(c.id,organization,auth.uid(),trim(message),trim(coalesce(lead_time,'')))
  on conflict(case_id,supplier_organization_id) do update set message=excluded.message,lead_time=excluded.lead_time,created_by=excluded.created_by,created_at=now() returning id into rid;
 perform private.delivery_event(c.id,c.stage,'Un fabricant inscrit propose de chiffrer cette demande. GSL étudie sa proposition avant de vous la présenter.');
 return jsonb_build_object('id',rid,'reference',c.reference);
end$$;
create or replace function public.respond_to_board_request(request_reference text,organization uuid,message text,lead_time text default '') returns jsonb language sql security invoker set search_path='' as $$select private.respond_to_board_request(request_reference,organization,message,lead_time)$$;

-- GSL administrators read the responses to relay them.
create or replace function private.request_board_responses(case_uuid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin_permission('contacts.read');
 return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'organization',x.supplier_organization_id,'name',coalesce(nullif(o.trading_name,''),o.legal_name),'country',o.country_code,'message',x.message,'lead_time',x.lead_time,'created_at',x.created_at) order by x.created_at desc) from private.request_board_responses x join public.organizations o on o.id=x.supplier_organization_id where x.case_id=case_uuid),'[]'::jsonb);
end$$;
create or replace function public.request_board_responses(case_uuid uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.request_board_responses(case_uuid)$$;

revoke all on function private.set_request_board(uuid,boolean,text[]),public.set_request_board(uuid,boolean,text[]),private.share_request_on_board(uuid,boolean),public.share_request_on_board(uuid,boolean),private.request_board(),public.request_board(),private.respond_to_board_request(text,uuid,text,text),public.respond_to_board_request(text,uuid,text,text),private.request_board_responses(uuid),public.request_board_responses(uuid) from public,anon,authenticated;
grant execute on function private.set_request_board(uuid,boolean,text[]),public.set_request_board(uuid,boolean,text[]),private.share_request_on_board(uuid,boolean),public.share_request_on_board(uuid,boolean),private.respond_to_board_request(text,uuid,text,text),public.respond_to_board_request(text,uuid,text,text),private.request_board_responses(uuid),public.request_board_responses(uuid) to authenticated;
grant execute on function private.request_board(),public.request_board() to anon,authenticated;
