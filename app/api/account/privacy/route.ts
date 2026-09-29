import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){if(!allowedOrigin(request))return json({error:'ORIGIN'},403);try{const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);const {data,error}=await db.rpc('request_erasure');if(error)throw error;return json({reference:data,state:'pending'})}catch{return json({error:'UNAVAILABLE'},503)}}
