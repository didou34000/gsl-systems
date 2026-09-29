import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {fileMime,safeFilename} from '@/lib/files/signature';
import {scanningAvailable,scanRequestFile} from '@/lib/files/scanner';
import {z} from 'zod';
export const dynamic='force-dynamic';export const maxDuration=60;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const q=new URL(request.url).searchParams,id=q.get('download'),rfq=q.get('rfq');
 if(id){if(!z.string().uuid().safeParse(id).success)return json({error:'INVALID'},400);const {data:file,error}=await db.from('files').select('object_path,original_name,upload_state').eq('id',id).maybeSingle();if(error)throw error;if(!file||file.upload_state!=='ready')return json({error:'NOT_FOUND'},404);
 const result=await db.storage.from('gsl-private').download(file.object_path);if(result.error)return json({error:'NOT_FOUND'},404);return new Response(result.data,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${safeFilename(file.original_name)}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"sandbox"}});}
 if(!z.string().uuid().safeParse(rfq).success)return json({error:'INVALID'},400);
 const {data:links,error}=await db.from('rfq_files').select('file_id,recipient_organization_id').eq('rfq_id',rfq!);if(error)throw error;
 if(!links?.length)return json({files:[],scanningAvailable:scanningAvailable()});const files=await db.from('files').select('id,original_name,size_bytes,scan_status,upload_state').in('id',links.map(x=>x.file_id)).neq('upload_state','removed');if(files.error)throw files.error;
 return json({files:files.data.map(f=>({...f,recipient:links.find(x=>x.file_id===f.id)?.recipient_organization_id})),scanningAvailable:scanningAvailable()});
 }catch{return json({error:'FILES_UNAVAILABLE'},503)}}
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 if(!scanningAvailable())return json({error:'SCAN_UNAVAILABLE'},503);
 if(Number(request.headers.get('content-length')||0)>3500000)return json({error:'FILE_SIZE'},413);
 try{const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const form=await request.formData(),file=form.get('file'),rfq=form.get('rfq'),recipient=form.get('recipient');
 if(!(file instanceof File)||!z.string().uuid().safeParse(rfq).success||recipient&&!z.string().uuid().safeParse(recipient).success)return json({error:'INVALID'},400);
 if(file.size<1||file.size>3145728)return json({error:'FILE_SIZE'},413);const bytes=new Uint8Array(await file.arrayBuffer()),mime=fileMime(bytes);if(!mime)return json({error:'FILE_TYPE'},422);
 const reserved=await db.rpc('manage_rfq_file',{action:'reserve',args:{rfq,recipient,name:file.name.slice(0,180),mime,size:file.size}});if(reserved.error)throw reserved.error;const {id,path}=reserved.data as {id:string;path:string};
 const cleanup=async()=>{await db.rpc('manage_rfq_file',{action:'delete',args:{rfq,id}});const removed=await db.storage.from('gsl-private').remove([path]);if(!removed.error)await db.rpc('manage_rfq_file',{action:'removed',args:{rfq,id}})};
 const upload=await db.storage.from('gsl-private').upload(path,bytes,{contentType:mime,upsert:false});if(upload.error){await cleanup();throw upload.error;}
 const final=await db.rpc('manage_rfq_file',{action:'finalize',args:{rfq,id}});if(final.error){await cleanup();throw final.error;}
 let scan='pending';try{scan=await scanRequestFile(id,bytes)||'pending'}catch{/* Durable pending state remains visible and blocks transmission. */}return json({ok:true,id,scan});
 }catch{return json({error:'UPLOAD_FAILED'},503)}}
export async function DELETE(request:Request){if(!allowedOrigin(request))return json({error:'ORIGIN'},403);try{const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);const q=new URL(request.url).searchParams,id=q.get('id'),rfq=q.get('rfq');if(!z.string().uuid().safeParse(id).success||!z.string().uuid().safeParse(rfq).success)return json({error:'INVALID'},400);const intent=await db.rpc('manage_rfq_file',{action:'delete',args:{rfq,id}});if(intent.error)throw intent.error;const removed=await db.storage.from('gsl-private').remove([intent.data.path]);if(removed.error)throw removed.error;const final=await db.rpc('manage_rfq_file',{action:'removed',args:{rfq,id}});if(final.error)throw final.error;return json({ok:true})}catch{return json({error:'DELETE_FAILED'},503)}}
