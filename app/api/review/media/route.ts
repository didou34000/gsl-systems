import {authClient} from '@/lib/supabase/server';
import {createClient} from '@supabase/supabase-js';
import {runtimeConfig} from '@/lib/runtime-config';
import {allowedOrigin} from '@/lib/auth-policy';
import {derivePublicImage} from '@/lib/files/derive-image';
import {z} from 'zod';
export const maxDuration=60;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){if(!allowedOrigin(request))return json({error:'ORIGIN'},403);try{const parsed=z.object({file:z.string().uuid(),confirmPublic:z.literal(true)}).strict().safeParse(await request.json());if(!parsed.success)return json({error:'INVALID'},400);if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return json({error:'MEDIA_NOT_CONFIGURED'},503);
 const db=await authClient();const {data,error}=await db.rpc('prepare_media',{source_file:parsed.data.file});if(error)return json({error:'REVIEW_OR_RIGHTS_REQUIRED'},403);const job=data as {id:string;sourcePath:string;path:string};
 const original=await db.storage.from('gsl-onboarding').download(job.sourcePath);if(original.error)throw original.error;const derived=await derivePublicImage(new Uint8Array(await original.data.arrayBuffer()));
 const {url}=runtimeConfig();const storage=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('gsl-derived-media');const uploaded=await storage.upload(job.path,derived,{contentType:'image/webp',upsert:false});if(uploaded.error)throw uploaded.error;
 const approved=await db.rpc('approve_media',{job_id:job.id});if(approved.error){await storage.remove([job.path]);throw approved.error;}return json({id:job.id,ok:true});
 }catch{return json({error:'MEDIA_UNAVAILABLE'},503)}}

export async function GET(){try{const db=await authClient();const {data,error}=await db.rpc('media_candidates');if(error)return json({error:'ACCESS_DENIED'},403);return json({files:data})}catch{return json({error:'UNAVAILABLE'},503)}}
