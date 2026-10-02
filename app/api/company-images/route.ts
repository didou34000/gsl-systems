import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {derivePublicImage} from '@/lib/files/derive-image';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"};
 try{const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'));if(!id.success)return new Response(null,{status:404,headers});
 const db=await authClient();const {data,error}=await db.rpc('company_image',{action:'read',args:{id:id.data}});if(error||!data)return new Response(null,{status:404,headers});
 const file=await db.storage.from('gsl-company-images').download(data.path);if(file.error)throw file.error;return new Response(file.data,{headers:{...headers,'Content-Type':'image/webp'}});
 }catch{return new Response(null,{status:503,headers})}
}
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 if(Number(request.headers.get('content-length')||0)>3500000)return json({error:'FILE_SIZE'},413);
 try{const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
 const form=await request.formData();const file=form.get('file');const kind=form.get('kind');if(!(file instanceof File)||!['logo','cover'].includes(String(kind)))return json({error:'INVALID'},400);
 if(!file.size||file.size>3*1024*1024)return json({error:'FILE_SIZE'},413);
 let bytes:Uint8Array;try{bytes=await derivePublicImage(new Uint8Array(await file.arrayBuffer()))}catch{return json({error:'FILE_TYPE'},400)}
 if(bytes.length>3*1024*1024)return json({error:'FILE_SIZE'},413);
 const reserved=await db.rpc('company_image',{action:'reserve',args:{kind,size:bytes.length}});if(reserved.error)throw reserved.error;
 const {id,path}=reserved.data as {id:string;path:string};const uploaded=await db.storage.from('gsl-company-images').upload(path,bytes,{contentType:'image/webp',upsert:false});
 if(uploaded.error){await db.storage.from('gsl-company-images').remove([path]);await db.rpc('company_image',{action:'cancel',args:{id}});throw uploaded.error}
 return json({id});
 }catch(e){const message=e&&typeof e==='object'&&'message' in e?String(e.message):'';return json({error:message.includes('IMAGE_LIMIT')?'IMAGE_LIMIT':message.includes('SAVE_FIRST')?'SAVE_FIRST':'UPLOAD_FAILED'},503)}
}
