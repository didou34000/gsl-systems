import {authClient} from '@/lib/supabase/server';
import {phoneDetails} from '@/lib/onboarding/phone';
import {getCountryRequirements} from '@/lib/onboarding/country-requirements';
import {allowedOrigin} from '@/lib/auth-policy';
import {productPublicationIssues,normalizeProductCategory,companyPublicationSchema,companyIssues,supplierSubmissionSchema,supplierDraftSchema,profileIssues,supplierValidationIssues,type SupplierFile} from '@/lib/onboarding/supplier-profile';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){try{
 const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const {data:application,error}=await db.from('supplier_applications').select('*').eq('owner_id',user.id).maybeSingle();if(error)throw error;
 const {data:files,error:fe}=await db.from('supplier_application_files').select('id,kind,name,size,caption,object_path').eq('owner_id',user.id).order('created_at');if(fe)throw fe;
 const signed=await Promise.all((files||[]).map(async f=>{const {data}=await db.storage.from('gsl-onboarding').createSignedUrl(f.object_path,600,{download:!['logo','factory','product'].includes(f.kind)});return {id:f.id,kind:f.kind,name:f.name,size:f.size,caption:f.caption,url:data?.signedUrl}}));
 const {data:events,error:ee}=await db.from('supplier_application_events').select('id,status,created_at').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(20);if(ee)throw ee;
 const {data:pendingUploads,error:pe}=await db.from('onboarding_uploads').select('id,name,state').eq('owner_id',user.id).in('state',['reserved','deleting','failed']);if(pe)throw pe;
 const publication=application?.organization_id?await db.from('published_supplier_profiles').select('organization_id,public_details').eq('organization_id',application.organization_id).is('withdrawn_at',null).maybeSingle():null;if(publication?.error)throw publication.error;
 const publishedProducts=application?.organization_id?await db.from('published_products').select('product_id',{count:'exact',head:true}).eq('organization_id',application.organization_id).is('withdrawn_at',null):null;if(publishedProducts?.error)throw publishedProducts.error;
 return json({application,publishedProducts:publishedProducts?.count||0,publication:publication?.data||null,files:signed,pendingUploads,events,email:user.email});
}catch{return json({error:'UNAVAILABLE'},503)}}
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 try{const raw=await request.text();if(raw.length>180000)return json({error:'INVALID'},413);let body;try{body=JSON.parse(raw)}catch{return json({error:'INVALID'},400)}
 if(!body||!['save','submit','reopen','publish','publish_products'].includes(body.action)||!Number.isInteger(body.revision)||body.revision<0)return json({error:'INVALID'},400);
 const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const {data:current,error:re}=await db.from('supplier_applications').select('revision,status').eq('owner_id',user.id).maybeSingle();if(re)throw re;
 if((current?.revision||0)!==body.revision)return json({error:'CONFLICT'},409);
 if(body.action==='publish_products'){
 const parsed=supplierDraftSchema.safeParse(body.profile);if(!parsed.success)return json({error:'INVALID'},400);
 const profile=parsed.data;profile.products=profile.products.map(p=>({...p,category:normalizeProductCategory(p.category)}));
 const issues=productPublicationIssues(profile);if(issues.length)return json({error:'INCOMPLETE',issues},422);
 const {data,error}=await db.rpc('publish_supplier_products',{profile,expected_revision:body.revision});if(error)throw error;
 return json({application:data});
 }
 if(body.action==='publish'){
 const parsed=companyPublicationSchema.safeParse(body.profile);if(!parsed.success)return json({error:'INVALID'},400);
 const issues=companyIssues(parsed.data);if(issues.length)return json({error:'INCOMPLETE',issues},422);
 const {data,error}=await db.rpc('publish_supplier_basics',{profile:parsed.data,expected_revision:body.revision});if(error)throw error;
 return json({application:data});
 }
 if(body.action==='reopen'){
 if(!current||!['reviewed','submitted','changes_requested'].includes(current.status))return json({error:'LOCKED'},409);
 const {data,error}=await db.rpc('reopen_supplier',{expected_revision:body.revision});if(error)throw error;if(!data)return json({error:'CONFLICT'},409);return json({application:data});}
 if(current&&!['draft','changes_requested'].includes(current.status))return json({error:'LOCKED'},409);
 const parsed=(body.action==='submit'?supplierSubmissionSchema:supplierDraftSchema).safeParse(body.profile);if(!parsed.success)return json({error:'INVALID',fields:parsed.error.issues.map(i=>i.path.join('.')),issues:body.action==='submit'?supplierValidationIssues(body.profile):[]},400);
 const profile=parsed.data;const phone=phoneDetails(profile.contact.phone,profile.contact.phoneCountry);profile.contact.phoneE164=phone.e164;
 if(body.action==='submit'&&profile.contact.phone&&!phone.valid)return json({error:'INVALID_PHONE',fields:['contact.phone']},422);
 if(body.action==='submit')profile.countryRulesVersion=getCountryRequirements(profile.country).version;
 if(profile.country)profile.headquarters.country=profile.country;
 if(body.action==='submit'){
 const {data:files,error}=await db.from('supplier_application_files').select('id,kind,name,size,caption').eq('owner_id',user.id);if(error)throw error;
 const issues=profileIssues(profile,(files||[]) as SupplierFile[]);if(issues.length)return json({error:'INCOMPLETE',issues},422);}
 const values={payload:profile,status:body.action==='submit'?'submitted':'draft'};
 const query=current?db.from('supplier_applications').update(values).eq('owner_id',user.id).eq('revision',body.revision):db.from('supplier_applications').insert({owner_id:user.id,...values});
 const {data,error}=await query.select('revision,status,updated_at').maybeSingle();if(error?.code==='23505')return json({error:'CONFLICT'},409);if(error)throw error;if(!data)return json({error:'CONFLICT'},409);
 return json({application:data});
 }catch(e){const code=e&&typeof e==='object'&&'message' in e?String(e.message):'';for(const known of ['IMAGE_NOT_READY','IMAGE_LIMIT','COMPANY_REQUIRED','CONFLICT','LOCKED','INCOMPLETE','FORBIDDEN'])if(code.includes(known))return json({error:known},409);if(e&&typeof e==='object'&&'message' in e&&String(e.message).includes('FILES_PENDING'))return json({error:'FILES_PENDING'},409);return json({error:'UNAVAILABLE'},503)}
}
