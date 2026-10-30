import {publicCatalogueValue} from '@/lib/public-contact';
import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {z} from 'zod';
import {searchSchema} from '@/lib/search-criteria';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const db=await authClient();const url=new URL(request.url);const view=url.searchParams.get('view')||'catalogue';
 if(view==='suppliers'){
  const ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean);if(ids.length>100||ids.some(id=>!z.string().uuid().safeParse(id).success))return json({error:'INVALID'},400);if(!ids.length)return json({suppliers:[]});const {data,error}=await db.from('published_supplier_profiles').select('organization_id,display_name,country_code,city,description,processes,materials').in('organization_id',ids).is('withdrawn_at',null);if(error)throw error;return json(publicCatalogueValue({suppliers:data}));
 }
 if(view==='selection'){
  const ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean);if(ids.length>100||ids.some(id=>!z.string().uuid().safeParse(id).success))return json({error:'INVALID'},400);
  if(!ids.length)return json({products:[]});const {data,error}=await db.from('component_products').select('product_id,organization_id,name,description,category,specifications').in('product_id',ids).is('withdrawn_at',null);if(error)throw error;const orgs=[...new Set((data||[]).map(p=>p.organization_id).filter(Boolean))];const makers=orgs.length?await db.from('component_supplier_profiles').select('organization_id,display_name').in('organization_id',orgs).is('withdrawn_at',null):{data:[]};return json(publicCatalogueValue({products:data,suppliers:makers.data||[]}));
 }
 if(view==='catalogue'){
  const values=Object.fromEntries([...url.searchParams].filter(([k])=>k!=='view'&&k!=='lang'));
  const parsed=searchSchema.safeParse(values);if(!parsed.success)return json({error:'INVALID_CRITERIA'},422);
  const {data,error}=await db.rpc('search_components_catalogue',{criteria:parsed.data});if(error)throw error;return json(publicCatalogueValue(data));
 }
 const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 if(view==='messages'){
  const thread=z.string().uuid().safeParse(url.searchParams.get('thread'));const page=z.coerce.number().int().min(0).max(100000).safeParse(url.searchParams.get('page')||0);
  if(!thread.success||!page.success)return json({error:'INVALID'},400);
  const {data,error}=await db.from('messages').select('id,thread_id,sender_organization_id,body,created_at').eq('thread_id',thread.data).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page.data*50,page.data*50+50);
  if(error)throw error;return json({messages:(data||[]).slice(0,50).reverse(),more:(data||[]).length>50});
 }
 if(view==='review'){
  // RLS limits ordinary users to their own row; dedicated RPC checks reviewer first.
  const {data,error}=await db.rpc('review_queue');if(error)return json({error:'REVIEW_ACCESS_REQUIRED'},403);return json({applications:data});
 }
 const company=z.string().uuid().safeParse(url.searchParams.get('organization'));const page=z.coerce.number().int().min(0).max(100000).safeParse(url.searchParams.get('page')||0);
 if(url.searchParams.has('organization')&&!company.success||!page.success)return json({error:'INVALID'},400);
 let focusedRequest=url.searchParams.get('request');const focusedThread=url.searchParams.get('thread');
 if((focusedRequest&&!z.string().uuid().safeParse(focusedRequest).success)||(focusedThread&&(!z.string().uuid().safeParse(focusedThread).success||focusedRequest)))return json({error:'INVALID'},400);
 const access=await db.rpc('messaging_access');if(access.error)throw access.error;
 const context=access.data as {mfaRequired:boolean;managedOrganizationIds:string[]};
 const managedIds=new Set(context.managedOrganizationIds);
 if(focusedThread){const thread=await db.from('threads').select('rfq_id').eq('id',focusedThread).maybeSingle();if(thread.error)throw thread.error;if(!thread.data)return json({error:context.mfaRequired?'MFA_REQUIRED':'FORBIDDEN'},403);focusedRequest=thread.data.rfq_id;}
 const [organizations,invitations,members]=await Promise.all([
  db.from('organizations').select('id,legal_name,country_code,buyer,supplier').order('legal_name'),
  db.from('organization_invitations').select('id,organization_id,email,role,state,expires_at').eq('state','pending').limit(100),
  db.from('memberships').select('organization_id,user_id,role,active').eq('active',true).limit(1000),
 ]);
 if([organizations,invitations,members].some(r=>r.error))throw Error('READ');
 const result=await db.rpc('workspace_requests',{company:company.success?company.data:null,page_number:page.data,request_id:focusedRequest});
 if(result.error){if(result.error.message.includes('FORBIDDEN'))return json({error:context.mfaRequired?'MFA_REQUIRED':'FORBIDDEN'},403);throw result.error}
 const workspace=result.data as {rfqs:Record<string,unknown>[];threads:unknown[];items:Record<string,unknown>[];offers:unknown[];page:number;hasMore:boolean;total:number};
 if(focusedRequest&&!workspace.rfqs.length)return json({error:context.mfaRequired?'MFA_REQUIRED':'FORBIDDEN'},403);
 return json({currentUser:{id:user.id,email:user.email},mfaRequired:context.mfaRequired,organizations:(organizations.data||[]).map(o=>({...o,managed_by_gsl:managedIds.has(o.id)})),rfqs:workspace.rfqs.map(r=>({...r,items:r.state==='draft'?((r.draft_items||[]) as Record<string,unknown>[]).map(i=>({...i,selected_product_id:i.product})):workspace.items.filter(i=>i.rfq_id===r.id)})),threads:workspace.threads,offers:workspace.offers,invitations:invitations.data,members:members.data,pagination:{page:workspace.page,hasMore:workspace.hasMore,total:workspace.total}});
}catch{return json({error:'PLATFORM_UNAVAILABLE'},503)}}
const commandSchema=z.object({action:z.enum(['buyer_company','enable_buyer','review','withdraw','save_rfq','send_rfq','message','offer','select_offer','cancel_rfq','share_assistance','add_recipient','claim_review','review_checks','invite_member','accept_invitation','remove_member','revoke_invitation']),command:z.string().uuid(),args:z.record(z.unknown())}).strict();
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 try{const raw=await request.text();if(raw.length>180000)return json({error:'INVALID'},413);const parsed=commandSchema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'INVALID'},400);
 const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const {data,error}=await db.rpc(['invite_member','accept_invitation','remove_member','revoke_invitation'].includes(parsed.data.action)?'manage_members':'workflow',parsed.data);
 if(error){const known=['COUNTRY_OUTSIDE_SCOPE','COMPANY_ALREADY_PRESENT','IDEMPOTENCY_CONFLICT','FILES_PENDING','CONFLICT','FORBIDDEN','INCOMPLETE','NOT_PUBLISHED','RECIPIENTS_REQUIRED','INVALID_OFFER','INVALID_LINE','FEEDBACK_REQUIRED','REPUBLICATION_REQUIRES_REVIEW','CONSENT_REQUIRED','REVIEW_CHECKS_REQUIRED','ASSIGNED_TO_ANOTHER_REVIEWER','RATE_LIMITED','ALREADY_MEMBER'];const code=known.find(c=>error.message.includes(c));return json({error:code||'PLATFORM_UNAVAILABLE'},code==='FORBIDDEN'?403:code==='CONFLICT'?409:code?422:503)}
 return json({ok:true,result:data});
 }catch{return json({error:'INVALID'},400)}
}
