import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {z} from 'zod';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){try{const db=await authClient();const {data,error}=await db.rpc('operations_overview');if(error)return json({error:'ACCESS_DENIED'},403);return json(data)}catch{return json({error:'UNAVAILABLE'},503)}}
export async function POST(request:Request){if(!allowedOrigin(request))return json({error:'ORIGIN'},403);try{const parsed=z.object({contact:z.string().uuid()}).strict().safeParse(await request.json());if(!parsed.success)return json({error:'INVALID'},400);const db=await authClient();const {error}=await db.rpc('resolve_contact',{contact_id:parsed.data.contact});if(error)return json({error:'ACCESS_DENIED'},403);return json({ok:true})}catch{return json({error:'UNAVAILABLE'},503)}}
