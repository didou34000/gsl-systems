-- Request board: buyers may opt in to show a summary of a submitted request to registered manufacturers.
-- Nothing is shared by default. Buyer identity, contact, delivery address, free-text details and files are never exposed.
alter table public.delivery_cases add column board_shared_at timestamptz;

create function private.share_request_on_board(case_uuid uuid,shared boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.delivery_cases;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into c from public.delivery_cases where id=case_uuid for update;
 if c.id is null or not private.is_member(c.organization_id,array['owner','admin','procurement']) then raise exception 'FORBIDDEN';end if;
 if c.submitted_at is null or c.stage in ('cancelled','closed') then raise exception 'CONFLICT';end if;
 update public.delivery_cases set board_shared_at=case when shared then coalesce(board_shared_at,now()) else null end,updated_at=now() where id=c.id;
 perform private.delivery_event(c.id,'board',case when shared then 'Résumé de la demande visible par les fabricants inscrits, sans identité ni coordonnées de l’acheteur.' else 'Résumé de la demande retiré de la page des demandes.' end);
 return jsonb_build_object('id',c.id,'shared',shared);
end$$;
create function public.share_request_on_board(case_uuid uuid,shared boolean) returns jsonb language sql security invoker set search_path='' as $$select private.share_request_on_board(case_uuid,shared)$$;

-- Anonymous visitors get the locked teaser; members of a manufacturer organization also get the title and item lines.
create function private.request_board() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare unlocked boolean;
begin
 unlocked:=auth.uid() is not null and exists(select 1 from public.memberships m join public.organizations o on o.id=m.organization_id where m.user_id=auth.uid() and m.active and o.supplier);
 return jsonb_build_object('unlocked',unlocked,'requests',coalesce((select jsonb_agg(row order by row->>'shared_at' desc) from (
  select jsonb_build_object(
   'reference',c.reference,'shared_at',c.board_shared_at,'destination',c.delivery->>'country',
   'deadline',r.deadline,'lines',(select count(*) from public.rfq_items i where i.rfq_id=r.id),
   'families',coalesce((select jsonb_agg(distinct p.category) from public.rfq_items i join public.component_products p on p.product_id=i.selected_product_id where i.rfq_id=r.id),'[]'::jsonb)
  )||case when unlocked then jsonb_build_object('title',r.title,'items',coalesce((select jsonb_agg(jsonb_build_object('description',i.description,'quantity',i.quantity,'unit',i.unit) order by i.id) from public.rfq_items i where i.rfq_id=r.id),'[]'::jsonb)) else '{}'::jsonb end as row
  from public.delivery_cases c join public.rfqs r on r.id=c.rfq_id
  where c.board_shared_at is not null and c.submitted_at is not null and c.stage not in ('cancelled','closed','delivered')
  order by c.board_shared_at desc limit 100) s),'[]'::jsonb));
end$$;
create function public.request_board() returns jsonb language sql stable security invoker set search_path='' as $$select private.request_board()$$;

revoke all on function private.share_request_on_board(uuid,boolean),private.request_board() from public,anon,authenticated;
grant execute on function private.share_request_on_board(uuid,boolean) to authenticated;
grant execute on function private.request_board() to anon,authenticated;
revoke all on function public.share_request_on_board(uuid,boolean),public.request_board() from public,anon,authenticated;
grant execute on function public.share_request_on_board(uuid,boolean) to authenticated;
grant execute on function public.request_board() to anon,authenticated;
