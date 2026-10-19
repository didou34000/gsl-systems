import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {derivePublicImage} from '@/lib/files/derive-image';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"};
 try{const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'));if(!id.success)return new Response(null,{status:404,headers});
  const db=await authClient();const file=await db.rpc('product_image',{action:'read',args:{id:id.data}});if(file.error||!file.data)return new Response(null,{status:404,headers});
  const object=await db.storage.from('gsl-product-images').download(file.data.path);if(object.error||!object.data)throw object.error;
  return new Response(object.data,{headers:{...headers,'Content-Type':'image/webp'}});
 }catch{return new Response(null,{status:503,headers})}
}
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 if(Number(request.headers.get('content-length')||0)>3500000)return json({error:'FILE_SIZE'},413);
 try{const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
  const form=await request.formData(),file=form.get('file'),product=z.string().uuid().safeParse(form.get('product'));
  if(!(file instanceof File)||!product.success||form.get('rightsAttested')!=='true')return json({error:'INVALID'},400);
  if(!file.size||file.size>3*1024*1024)return json({error:'FILE_SIZE'},413);
  let bytes:Uint8Array;try{bytes=await derivePublicImage(new Uint8Array(await file.arrayBuffer()))}catch{return json({error:'FILE_TYPE'},400)}
  if(bytes.length>3*1024*1024)return json({error:'FILE_SIZE'},413);
  const reserved=await db.rpc('product_image',{action:'reserve',args:{product:product.data,size:bytes.length}});if(reserved.error)throw reserved.error;
  const {id,path}=reserved.data as {id:string;path:string};
  try{const upload=await db.storage.from('gsl-product-images').upload(path,bytes,{contentType:'image/webp',upsert:false});if(upload.error)throw upload.error;
   const ready=await db.rpc('product_image',{action:'finalize',args:{id}});if(ready.error)throw ready.error;
  }catch(e){const cleanup=await db.storage.from('gsl-product-images').remove([path]);if(!cleanup.error)await db.rpc('product_image',{action:'cancel',args:{id}});throw e;}
  return json({id});
 }catch(e){const message=e&&typeof e==='object'&&'message'in e?String(e.message):'';return json({error:message.includes('IMAGE_LIMIT')?'IMAGE_LIMIT':message.includes('SAVE_FIRST')?'SAVE_FIRST':'UPLOAD_FAILED'},503)}
}
