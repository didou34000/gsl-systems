-- Server-side company scope and pagination; RLS remains active in every query.
create function public.workspace_requests(company uuid,page_number integer default 0) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if page_number is null or page_number<0 or page_number>100000 then raise exception 'INVALID';end if;
 if not private.is_member(company) then raise exception 'FORBIDDEN';end if;
 with eligible as (
  select r.* from public.rfqs r where r.organization_id=company or exists(select 1 from public.threads t where t.rfq_id=r.id and t.supplier_organization_id=company)
 ), page as (
  select * from eligible order by created_at desc,id desc limit 20 offset (page_number*20)
 ), conversations as (
  select t.* from public.threads t join page p on p.id=t.rfq_id where p.organization_id=company or t.supplier_organization_id=company
 )
 select jsonb_build_object(
  'total',(select count(*) from eligible),'page',page_number,'hasMore',(select count(*) from eligible)>(page_number+1)*20,
  'rfqs',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc),'[]') from page p),
  'threads',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from conversations t),
  'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.rfq_items i where i.rfq_id in(select id from page)),
  'offers',(select coalesce(jsonb_agg(to_jsonb(o) order by o.version desc),'[]') from public.offers o where o.thread_id in(select id from conversations))
 ) into result;
 return result;
end $$;
revoke all on function public.workspace_requests(uuid,integer) from public,anon;
grant execute on function public.workspace_requests(uuid,integer) to authenticated;
