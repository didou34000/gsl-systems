import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
const id=z.string().uuid();
const input=z.discriminatedUnion('action',[
 z.object({action:z.enum(['company.verify','company.unverify','product.unverify']),id}).strict(),
 z.object({action:z.literal('product.verify'),id,family:z.string().max(80),site:z.string().trim().min(3).max(500),roboticsOffer:z.string().trim().min(21).max(4000),source:z.string().url().max(2048).regex(/^https?:\/\//i)}).strict(),
]);
const codes=['LOGIN_REQUIRED','ADMIN_REQUIRED','MFA_REQUIRED','PERMISSION_REQUIRED','NOT_FOUND','INVALID','COMPANY_REQUIRED','COUNTRY_OUTSIDE_SCOPE'] as const;
function failure(e:{message?:string;code?:string}){const code=codes.find(c=>e.message?.includes(c));return json({error:code||(e.code==='PGRST202'||e.code==='42883'?'NOT_CONFIGURED':'UNAVAILABLE')},code==='LOGIN_REQUIRED'?401:code&&['ADMIN_REQUIRED','MFA_REQUIRED','PERMISSION_REQUIRED'].includes(code)?403:code==='NOT_FOUND'?404:code?409:503)}
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 try{const raw=await request.text();if(raw.length>10000)return json({error:'INVALID'},413);let body;try{body=JSON.parse(raw)}catch{return json({error:'INVALID'},400)}const parsed=input.safeParse(body);if(!parsed.success)return json({error:'INVALID'},400);
  const {action,...rest}=parsed.data;
  const args='source' in rest?{id:rest.id,family:rest.family,site:rest.site,roboticsOffer:rest.roboticsOffer,sources:[{url:rest.source,title:'Source consultée pour la vérification du produit'}]}:{id:rest.id};
  const db=await authClient();const r=await db.rpc('admin_verification',{action,args});
  return r.error?failure(r.error):json(r.data);
 }catch{return failure({})}
}
