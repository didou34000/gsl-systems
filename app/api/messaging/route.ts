import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=z.string().uuid();
export async function GET(request:Request){
 try{
  const url=new URL(request.url),db=await authClient();const {data:{user}}=await db.auth.getUser();
  const productId=url.searchParams.get('product');let product=null;
  if(productId&&!url.searchParams.get('conversation')){if(!uuid.safeParse(productId).success)return json({error:'INVALID'},400);const found=await db.from('published_products').select('product_id,organization_id,name,description').eq('product_id',productId).is('withdrawn_at',null).maybeSingle();if(found.error)throw found.error;if(!found.data)return json({error:'NOT_PUBLISHED'},404);const s=await db.from('published_supplier_profiles').select('display_name').eq('organization_id',found.data.organization_id).is('withdrawn_at',null).maybeSingle();if(s.error)throw s.error;if(!s.data)return json({error:'NOT_PUBLISHED'},404);product={...found.data,supplier_name:s.data.display_name};}
  if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED',product},401);
  const membership=await db.from('memberships').select('organization_id,role').eq('user_id',user.id).eq('active',true).in('role',['owner','admin','procurement','sales']);if(membership.error)throw membership.error;
  const ids=(membership.data||[]).map(m=>m.organization_id);const companies=ids.length?await db.from('organizations').select('id,legal_name,buyer,supplier,country_code').in('id',ids):{data:[],error:null};if(companies.error)throw companies.error;
  const organizations=(companies.data||[]).map(o=>({...o,can_buy:o.buyer&&membership.data!.some(m=>m.organization_id===o.id&&['owner','admin','procurement'].includes(m.role))}));
  const company=url.searchParams.get('organization')||organizations[0]?.id||null;if(company&&(!uuid.safeParse(company).success||!ids.includes(company)))return json({error:'FORBIDDEN'},403);
  const page=z.coerce.number().int().min(0).max(10000).safeParse(url.searchParams.get('page')||0);if(!page.success)return json({error:'INVALID'},400);
  const conversations=company?await db.from('product_conversations').select('*').or(`buyer_organization_id.eq.${company},supplier_organization_id.eq.${company}`).order('updated_at',{ascending:false}).order('id',{ascending:false}).range(page.data*30,page.data*30+30):{data:[],error:null};if(conversations.error)throw conversations.error;
  const conversation=url.searchParams.get('conversation');let selected=null;let messages:unknown[]=[];let moreMessages=false;
  if(conversation){if(!uuid.safeParse(conversation).success)return json({error:'INVALID'},400);const c=await db.from('product_conversations').select('*').eq('id',conversation).maybeSingle();if(c.error)throw c.error;if(!c.data||![c.data.buyer_organization_id,c.data.supplier_organization_id].includes(company))return json({error:'FORBIDDEN'},403);selected=c.data;
   let query=db.from('product_messages').select('id,body,sender_organization_id,created_at').eq('conversation_id',conversation).order('created_at',{ascending:false}).order('id',{ascending:false});
   const before=url.searchParams.get('before');if(before){if(!z.string().datetime({offset:true}).safeParse(before).success)return json({error:'INVALID'},400);const beforeId=url.searchParams.get('beforeId');if(!uuid.safeParse(beforeId).success)return json({error:'INVALID'},400);query=query.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`);}
   const history=await query.limit(51);if(history.error)throw history.error;moreMessages=(history.data||[]).length>50;messages=(history.data||[]).slice(0,50).reverse();
  }
  let existingConversation:string|null=null;
  if(product&&company&&!conversation){const existing=await db.from('product_conversations').select('id').eq('buyer_organization_id',company).eq('supplier_organization_id',product.organization_id).eq('product_id',product.product_id).maybeSingle();if(existing.error)throw existing.error;existingConversation=existing.data?.id||null;}
  return json({existingConversation,product,organizations,organization:company,conversations:(conversations.data||[]).slice(0,30),moreConversations:(conversations.data||[]).length>30,selected,messages,moreMessages});
 }catch{return json({error:'UNAVAILABLE'},503)}
}
const command=z.object({organization:uuid,product:uuid.nullable(),conversation:uuid.nullable(),body:z.string().trim().min(1).max(10000),command:uuid}).strict().refine(d=>Boolean(d.product)!==Boolean(d.conversation));
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 let parsed;try{const text=await request.text();if(text.length>15000)return json({error:'INVALID'},413);parsed=command.safeParse(JSON.parse(text))}catch{return json({error:'INVALID'},400)}if(!parsed.success)return json({error:'INVALID'},400);
 try{const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);const d=parsed.data;const result=await db.rpc('send_product_message',{p_company:d.organization,p_product:d.product,p_conversation:d.conversation,p_body:d.body,p_command:d.command});if(result.error){const code=['FORBIDDEN','NOT_PUBLISHED','OWN_PRODUCT','RATE_LIMITED','IDEMPOTENCY_CONFLICT'].find(c=>result.error.message.includes(c));return json({error:code||'UNAVAILABLE'},code==='FORBIDDEN'?403:code?422:503)}return json(result.data);
 }catch{return json({error:'UNAVAILABLE'},503)}
}
