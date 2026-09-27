import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 if(Number(request.headers.get('content-length')||0)>3500000)return json({error:'FILE_SIZE'},413);
 try{const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const {data:app,error:ae}=await db.from('supplier_applications').select('status').eq('owner_id',user.id).maybeSingle();if(ae)throw ae;if(!app)return json({error:'SAVE_FIRST'},409);if(!['draft','changes_requested'].includes(app.status))return json({error:'LOCKED'},409);
 const form=await request.formData();const file=form.get('file');const kind=String(form.get('kind')||'');const caption=String(form.get('caption')||'').trim();
 if(!(file instanceof File)||!['logo','factory','product','registration','certificate','technical'].includes(kind)||caption.length>250)return json({error:'INVALID'},400);
 if(!file.size||file.size>3*1024*1024)return json({error:'FILE_SIZE'},413);
 const {count,error:ce}=await db.from('supplier_application_files').select('id',{count:'exact',head:true}).eq('owner_id',user.id);if(ce)throw ce;if((count||0)>=40)return json({error:'FILE_LIMIT'},400);
 const bytes=new Uint8Array(await file.arrayBuffer());const pdf=bytes.slice(0,5).toString()==='37,80,68,70,45';const png=bytes.slice(0,8).toString()==='137,80,78,71,13,10,26,10';const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const webp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 const mime=pdf?'application/pdf':png?'image/png':jpg?'image/jpeg':webp?'image/webp':'';
 if(!mime||(['logo','factory','product'].includes(kind)&&pdf))return json({error:'FILE_TYPE'},400);
 const id=crypto.randomUUID();const path=`${user.id}/${id}.${pdf?'pdf':png?'png':jpg?'jpg':'webp'}`;
 const {error:ue}=await db.storage.from('gsl-onboarding').upload(path,bytes,{contentType:mime,upsert:false});if(ue)throw ue;
 const {error:ie}=await db.from('supplier_application_files').insert({id,owner_id:user.id,object_path:path,kind,name:file.name.slice(0,180),size:file.size,caption});if(ie){await db.storage.from('gsl-onboarding').remove([path]);throw ie;}
 return json({ok:true});
 }catch{return json({error:'UNAVAILABLE'},503)}
}
export async function DELETE(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 try{const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const id=new URL(request.url).searchParams.get('id');if(!id||!/^[-0-9a-f]{36}$/.test(id))return json({error:'INVALID'},400);
 const {data:app}=await db.from('supplier_applications').select('status').eq('owner_id',user.id).maybeSingle();if(!app||!['draft','changes_requested'].includes(app.status))return json({error:'LOCKED'},409);
 const {data:file,error}=await db.from('supplier_application_files').select('object_path').eq('owner_id',user.id).eq('id',id).maybeSingle();if(error)throw error;if(!file)return json({error:'NOT_FOUND'},404);
 const {error:se}=await db.storage.from('gsl-onboarding').remove([file.object_path]);if(se)throw se;
 const {error:de}=await db.from('supplier_application_files').delete().eq('id',id).eq('owner_id',user.id);if(de)throw de;return json({ok:true});
 }catch{return json({error:'UNAVAILABLE'},503)}
}
