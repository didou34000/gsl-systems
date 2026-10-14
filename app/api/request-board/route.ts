import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
const notConfigured=(code?:string)=>['PGRST202','42883','42P01'].includes(code||'');
export async function GET(){try{const db=await authClient();const {data,error}=await db.rpc('request_board');if(error)return json({error:notConfigured(error.code)?'NOT_CONFIGURED':'UNAVAILABLE'},503);return json(data);}catch{return json({error:'UNAVAILABLE'},503)}}
const share=z.object({id:z.string().uuid(),shared:z.boolean()}).strict();
export async function POST(request:Request){if(!allowedOrigin(request))return json({error:'ORIGIN'},403);try{const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);const parsed=share.safeParse(JSON.parse(await request.text()));if(!parsed.success)return json({error:'INVALID'},422);const {data,error}=await db.rpc('share_request_on_board',{case_uuid:parsed.data.id,shared:parsed.data.shared});if(error){const code=['FORBIDDEN','CONFLICT','LOGIN_REQUIRED'].find(k=>error.message.includes(k));return json({error:code||(notConfigured(error.code)?'NOT_CONFIGURED':'UNAVAILABLE')},code==='FORBIDDEN'?403:code==='CONFLICT'?409:code?401:503);}return json({ok:true,result:data});}catch{return json({error:'UNAVAILABLE'},503)}}
