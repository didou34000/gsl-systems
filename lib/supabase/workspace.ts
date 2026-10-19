import {z} from 'zod';
import {workspaceIdentity} from '@/lib/workspace-identity';
import {authClient} from './server';
import {allowedOrigin} from '@/lib/auth-policy';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const draft=z.object({action:z.literal('draft'),id:z.string().uuid(),revision:z.number().int().min(0),kind:z.enum(['rfq','supplier']),title:z.string().max(160),payload:z.record(z.string().max(80),z.string().max(8000))}).strict();
const favorite=z.object({action:z.literal('favorite'),productId:z.string().uuid(),selected:z.boolean()}).strict();
export async function readWorkspace(){try{
 const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const [drafts,favorites,profile,organizations,application]=await Promise.all([db.from('workspace_drafts').select('id,kind,title,payload,revision,created_at,updated_at').eq('owner_id',user.id).order('updated_at',{ascending:false}).limit(100),db.from('saved_selections').select('product_id').eq('owner_id',user.id).limit(100),db.from('profiles').select('display_name').eq('user_id',user.id).maybeSingle(),db.from('organizations').select('id,legal_name,trading_name,buyer,supplier').order('created_at').limit(20),db.from('supplier_applications').select('organization_id,payload').eq('owner_id',user.id).maybeSingle()]);
 if(drafts.error||favorites.error||organizations.error||application.error)return json({error:'WORKSPACE_UNAVAILABLE'},503);
 const identity=workspaceIdentity(organizations.data||[],application.data);
 return json({user:{name:profile.data?.display_name||user.user_metadata?.display_name||'',email:user.email},...identity,drafts:drafts.data,favorites:favorites.data.map(f=>f.product_id)});
}catch{return json({error:'WORKSPACE_UNAVAILABLE'},503)}}
export async function writeWorkspace(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 try{const text=await request.text();if(text.length>18000)return json({error:'INVALID'},413);const parsed=z.union([draft,favorite]).safeParse(JSON.parse(text));if(!parsed.success)return json({error:'INVALID'},400);
 const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const b=parsed.data;const result=b.action==='draft'?await db.rpc('save_workspace_draft',{p_id:b.id,p_revision:b.revision,p_kind:b.kind,p_title:b.title,p_payload:b.payload}):await db.rpc('set_selection',{p_product:b.productId,p_selected:b.selected});
 if(result.error)return json({error:result.error.message.includes('CONFLICT')?'CONFLICT':result.error.message.includes('NOT_PUBLISHED')?'NOT_PUBLISHED':'WORKSPACE_UNAVAILABLE'},result.error.message.includes('CONFLICT')?409:result.error.message.includes('NOT_PUBLISHED')?422:503);
 return json({ok:true,...(b.action==='draft'?{id:b.id,revision:result.data.revision}:{})});
 }catch{return json({error:'INVALID'},400)}
}
