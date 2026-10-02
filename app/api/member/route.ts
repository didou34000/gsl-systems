import {authClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){try{
 const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const results=await Promise.all([
  db.from('saved_selections').select('product_id',{count:'exact'}).eq('owner_id',user.id).limit(1),
  db.from('rfqs').select('id,title,state,organization_id,updated_at').order('updated_at',{ascending:false}).limit(8),
  db.from('product_conversations').select('id,product_name,buyer_organization_id,supplier_organization_id,updated_at').order('updated_at',{ascending:false}).limit(5),
  db.from('supplier_applications').select('status,revision,updated_at,payload').eq('owner_id',user.id).maybeSingle(),
  db.from('organizations').select('id,legal_name,buyer,supplier'),
 ]);
 if(results.some(r=>r.error))return json({error:'UNAVAILABLE'},503);
 const [favorites,requests,conversations,application,organizations]=results;const p=application.data?.payload;
 return json({user:{name:user.user_metadata?.display_name||'',email:user.email},favorites:favorites.count||0,requests:requests.data,conversations:conversations.data,organizations:organizations.data,application:application.data?{status:application.data.status,updated_at:application.data.updated_at,name:p?.tradingName||p?.legalName||'',products:Array.isArray(p?.products)?p.products.length:0}:null});
}catch{return json({error:'UNAVAILABLE'},503)}}
