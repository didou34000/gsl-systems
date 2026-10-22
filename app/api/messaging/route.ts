import {findReferencedMaker} from '@/lib/referenced-makers';
import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {z} from 'zod';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=z.string().uuid();
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const sourced=(details:unknown)=>record(record(details).research).kind==='gsl_research';
type Summary={id:string;unread:number;last_body:string|null;supplier_managed_by_gsl:boolean};

export async function GET(request:Request){
 try{
  const url=new URL(request.url),db=await authClient();
  const {data:{user}}=await db.auth.getUser();
  const productId=url.searchParams.get('product'),supplierId=url.searchParams.get('supplier'),conversation=url.searchParams.get('conversation');
  const referenced=supplierId?findReferencedMaker(supplierId):null;
  const filterOrganization=url.searchParams.get('organization'),requestedReply=url.searchParams.get('replyOrganization');
  for(const id of [conversation,filterOrganization,requestedReply])if(id&&!uuid.safeParse(id).success)return json({error:'INVALID'},400);
  let product=null,supplier=null;
  if(productId&&!conversation){
   if(supplierId||!uuid.safeParse(productId).success)return json({error:'INVALID'},400);
   const found=await db.from('published_products').select('product_id,organization_id,name,description').eq('product_id',productId).is('withdrawn_at',null).maybeSingle();
   if(found.error)throw found.error;if(!found.data)return json({error:'NOT_PUBLISHED'},404);
   const s=await db.from('published_supplier_profiles').select('display_name,public_details').eq('organization_id',found.data.organization_id).is('withdrawn_at',null).maybeSingle();
   if(s.error)throw s.error;if(!s.data)return json({error:'NOT_PUBLISHED'},404);
   product={...found.data,supplier_name:s.data.display_name,supplier_managed_by_gsl:sourced(s.data.public_details)};
  }
  if(referenced&&!conversation){
   if(productId)return json({error:'INVALID'},400);
   let organization=supplierId!;
   if(user?.email_confirmed_at){
    const target=await db.rpc('referenced_messaging_target',{reference:supplierId});
    if(target.error){if(target.error.message.includes('NOT_PUBLISHED'))return json({error:'NOT_PUBLISHED'},404);throw target.error;}
    if(!uuid.safeParse(target.data).success)throw Error('INVALID_TARGET');organization=target.data as string;
   }
   supplier={organization_id:organization,display_name:referenced[0].company,supplier_managed_by_gsl:true};
  }
  if(supplierId&&!referenced&&!conversation){
   if(!uuid.safeParse(supplierId).success)return json({error:'INVALID'},400);
   const found=await db.from('published_supplier_profiles').select('organization_id,display_name,public_details').eq('organization_id',supplierId).is('withdrawn_at',null).maybeSingle();
   if(found.error)throw found.error;if(!found.data)return json({error:'NOT_PUBLISHED'},404);
   supplier={organization_id:found.data.organization_id,display_name:found.data.display_name,supplier_managed_by_gsl:sourced(found.data.public_details)};
  }
  if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED',product,supplier},401);
  if(url.searchParams.get('unread')==='1'){
   const result=await db.rpc('messaging_unread');if(result.error)throw result.error;return json({unread:Number(result.data)});
  }
  const access=await db.rpc('messaging_access');if(access.error)throw access.error;
  const context=record(access.data),mfaRequired=context.mfaRequired===true;
  const managedIds=new Set(Array.isArray(context.managedOrganizationIds)?context.managedOrganizationIds.filter((id):id is string=>typeof id==='string'):[]);
  const membership=await db.from('memberships').select('organization_id,role').eq('user_id',user.id).eq('active',true).in('role',['owner','admin','procurement','sales']);
  if(membership.error)throw membership.error;
  const ids=(membership.data||[]).map(m=>m.organization_id);
  const companies=ids.length?await db.from('organizations').select('id,legal_name,buyer,supplier,country_code').in('id',ids):{data:[],error:null};
  if(companies.error)throw companies.error;
  const organizations=(companies.data||[]).map(o=>{
   const role=membership.data!.find(m=>m.organization_id===o.id)?.role||'';
   return {...o,can_buy:['owner','admin','procurement'].includes(role),can_sell:['owner','admin','sales'].includes(role),managed_by_gsl:managedIds.has(o.id)};
  }).sort((a,b)=>Number(a.managed_by_gsl)-Number(b.managed_by_gsl)||a.legal_name.localeCompare(b.legal_name));
  if(filterOrganization&&!organizations.some(o=>o.id===filterOrganization))return json({error:mfaRequired?'MFA_REQUIRED':'FORBIDDEN'},403);
  let selected=null;
  if(conversation){
   const found=await db.from('product_conversations').select('*').eq('id',conversation).maybeSingle();
   if(found.error)throw found.error;if(!found.data)return json({error:mfaRequired?'MFA_REQUIRED':'FORBIDDEN'},403);selected=found.data;
  }
  const target=supplier?.organization_id||product?.organization_id;
  const replyOrganizations=organizations.filter(o=>selected?
   (o.id===selected.buyer_organization_id&&o.can_buy)||(o.id===selected.supplier_organization_id&&o.can_sell):o.can_buy&&o.id!==target);
  if(requestedReply&&!replyOrganizations.some(o=>o.id===requestedReply))return json({error:'FORBIDDEN'},403);
  // Reading an aggregate inbox never silently chooses between both sides of a
  // conversation. An explicit sender is required when the user represents both.
  const company=requestedReply||(filterOrganization&&replyOrganizations.some(o=>o.id===filterOrganization)?filterOrganization:null)
   ||(replyOrganizations.length===1?replyOrganizations[0].id:null);
  const page=z.coerce.number().int().min(0).max(10000).safeParse(url.searchParams.get('page')||0);
  if(!page.success)return json({error:'INVALID'},400);
  let list=db.from('product_conversations').select('*');
  if(filterOrganization)list=list.or(`buyer_organization_id.eq.${filterOrganization},supplier_organization_id.eq.${filterOrganization}`);
  // Row security restricts this unfiltered query to every authorized company.
  const conversations=await list.order('updated_at',{ascending:false}).order('id',{ascending:false}).range(page.data*30,page.data*30+30);
  if(conversations.error)throw conversations.error;
  let messages:unknown[]=[],moreMessages=false;
  if(conversation){
   let historyQuery=db.from('product_messages').select('id,body,sender_organization_id,created_at').eq('conversation_id',conversation).order('created_at',{ascending:false}).order('id',{ascending:false});
   const before=url.searchParams.get('before');
   if(before){
    if(!z.string().datetime({offset:true}).safeParse(before).success)return json({error:'INVALID'},400);
    const beforeId=url.searchParams.get('beforeId');if(!uuid.safeParse(beforeId).success)return json({error:'INVALID'},400);
    historyQuery=historyQuery.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`);
   }
   const history=await historyQuery.limit(51);if(history.error)throw history.error;
   moreMessages=(history.data||[]).length>50;messages=(history.data||[]).slice(0,50).reverse();
  }
  let existingConversation:string|null=null;
  if(target&&company&&!conversation){
   let existingQuery=db.from('product_conversations').select('id').eq('buyer_organization_id',company).eq('supplier_organization_id',target);
   existingQuery=product?existingQuery.eq('product_id',product.product_id):existingQuery.is('product_id',null);
   const existing=await existingQuery.maybeSingle();if(existing.error)throw existing.error;existingConversation=existing.data?.id||null;
  }
  const rows=(conversations.data||[]).slice(0,30),summaryIds=Array.from(new Set([...rows.map(c=>c.id),...(selected?[selected.id]:[])]));
  const summaries=await db.rpc('messaging_summary',{p_ids:summaryIds});if(summaries.error)throw summaries.error;
  const byId=new Map((summaries.data as Summary[]).map(s=>[s.id,s]));
  return json({existingConversation,product,supplier,organizations,organization:company,filterOrganization,replyOrganizations,mfaRequired,
   conversations:rows.map(c=>({...c,...byId.get(c.id)})),moreConversations:(conversations.data||[]).length>30,
   selected:selected?{...selected,...byId.get(selected.id)}:null,messages,moreMessages});
 }catch{return json({error:'UNAVAILABLE'},503)}
}

const command=z.object({organization:uuid,product:uuid.nullable(),supplier:uuid.nullable().optional(),conversation:uuid.nullable(),body:z.string().trim().min(1).max(10000),command:uuid}).strict().refine(d=>[d.product,d.supplier,d.conversation].filter(Boolean).length===1);
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 let parsed;try{const text=await request.text();if(text.length>15000)return json({error:'INVALID'},413);parsed=command.safeParse(JSON.parse(text))}catch{return json({error:'INVALID'},400)}
 if(!parsed.success)return json({error:'INVALID'},400);
 try{
  const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
  const d=parsed.data,result=await db.rpc('send_direct_message',{p_company:d.organization,p_product:d.product,p_supplier:d.supplier||null,p_conversation:d.conversation,p_body:d.body,p_command:d.command});
  if(result.error){const code=['FORBIDDEN','NOT_PUBLISHED','OWN_PRODUCT','RATE_LIMITED','IDEMPOTENCY_CONFLICT'].find(c=>result.error.message.includes(c));return json({error:code||'UNAVAILABLE'},code==='FORBIDDEN'?403:code?422:503)}
  return json(result.data);
 }catch{return json({error:'UNAVAILABLE'},503)}
}

export async function PATCH(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 try{
  const raw=await request.text();if(raw.length>3000)return json({error:'INVALID'},413);
  const parsed=z.object({messages:z.array(uuid).max(50)}).strict().safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'INVALID'},400);
  const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
  const result=await db.rpc('mark_messages_read',{p_messages:parsed.data.messages});if(result.error)throw result.error;return json({ok:true});
 }catch{return json({error:'UNAVAILABLE'},503)}
}
