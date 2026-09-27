import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {supplierSchema,profileIssues,type SupplierFile} from '@/lib/onboarding/supplier-profile';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){try{
 const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const {data:application,error}=await db.from('supplier_applications').select('*').eq('owner_id',user.id).maybeSingle();if(error)throw error;
 const {data:files,error:fe}=await db.from('supplier_application_files').select('id,kind,name,size,caption,object_path').eq('owner_id',user.id).order('created_at');if(fe)throw fe;
 const signed=await Promise.all((files||[]).map(async f=>{const {data}=await db.storage.from('gsl-onboarding').createSignedUrl(f.object_path,600,{download:!['logo','factory','product'].includes(f.kind)});return {id:f.id,kind:f.kind,name:f.name,size:f.size,caption:f.caption,url:data?.signedUrl}}));
 const {data:events,error:ee}=await db.from('supplier_application_events').select('id,status,created_at').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(20);if(ee)throw ee;
 return json({application,files:signed,events,email:user.email});
}catch{return json({error:'UNAVAILABLE'},503)}}
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 try{const raw=await request.text();if(raw.length>180000)return json({error:'INVALID'},413);let body;try{body=JSON.parse(raw)}catch{return json({error:'INVALID'},400)}
 if(!body||!['save','submit','reopen'].includes(body.action)||!Number.isInteger(body.revision)||body.revision<0)return json({error:'INVALID'},400);
 const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const {data:current,error:re}=await db.from('supplier_applications').select('revision,status').eq('owner_id',user.id).maybeSingle();if(re)throw re;
 if((current?.revision||0)!==body.revision)return json({error:'CONFLICT'},409);
 if(body.action==='reopen'){
 if(!current||!['submitted','changes_requested'].includes(current.status))return json({error:'LOCKED'},409);
 const {data,error}=await db.from('supplier_applications').update({status:'draft'}).eq('owner_id',user.id).eq('revision',body.revision).select('revision,status,updated_at').maybeSingle();if(error)throw error;if(!data)return json({error:'CONFLICT'},409);return json({application:data});}
 if(current&&!['draft','changes_requested'].includes(current.status))return json({error:'LOCKED'},409);
 const parsed=supplierSchema.safeParse(body.profile);if(!parsed.success)return json({error:'INVALID',fields:parsed.error.issues.map(i=>i.path.join('.'))},400);
 const profile=parsed.data;
 if(profile.country)profile.headquarters.country=profile.country;
 if(body.action==='submit'){
 const {data:files,error}=await db.from('supplier_application_files').select('id,kind,name,size,caption').eq('owner_id',user.id);if(error)throw error;
 const issues=profileIssues(profile,(files||[]) as SupplierFile[]);if(issues.length)return json({error:'INCOMPLETE',issues},422);}
 const values={payload:profile,status:body.action==='submit'?'submitted':'draft'};
 const query=current?db.from('supplier_applications').update(values).eq('owner_id',user.id).eq('revision',body.revision):db.from('supplier_applications').insert({owner_id:user.id,...values});
 const {data,error}=await query.select('revision,status,updated_at').maybeSingle();if(error?.code==='23505')return json({error:'CONFLICT'},409);if(error)throw error;if(!data)return json({error:'CONFLICT'},409);
 return json({application:data});
 }catch{return json({error:'UNAVAILABLE'},503)}
}
