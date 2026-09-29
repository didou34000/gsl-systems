import {authClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"};
 try{const id=new URL(request.url).searchParams.get('id');if(!id||!/^[a-f0-9-]{36}$/i.test(id))return new Response(null,{status:400,headers});const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user)return new Response(null,{status:401,headers});
 const {data:file,error}=await db.from('supplier_application_files').select('object_path,name,owner_id').eq('id',id).maybeSingle();if(error||!file)return new Response(null,{status:404,headers});
 const {data:assignment}=await db.from('review_assignments').select('owner_id').eq('owner_id',file.owner_id).eq('reviewer_id',user.id).maybeSingle();if(!assignment)return new Response(null,{status:403,headers});
 const {data,error:downloadError}=await db.storage.from('gsl-onboarding').download(file.object_path);if(downloadError||!data)return new Response(null,{status:503,headers});
 return new Response(data,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(file.name.replace(/[\r\n]/g,''))}`}});
 }catch{return new Response(null,{status:503,headers})}
}
