import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
const input=z.object({id:z.string().uuid(),revision:z.number().int().positive(),decision:z.enum(['approve','changes_requested']),feedback:z.string().trim().min(5).max(2000),family:z.string().max(80).optional(),site:z.string().trim().max(500).optional(),roboticsOffer:z.string().trim().max(4000).optional(),source:z.string().url().max(2048).optional()}).strict();
function failure(e:{message?:string;code?:string}){const code=['LOGIN_REQUIRED','ADMIN_REQUIRED','MFA_REQUIRED','PERMISSION_REQUIRED','CONFLICT','NOT_FOUND','FORBIDDEN','INVALID','INCOMPLETE','IMAGE_NOT_READY','COMPANY_REQUIRED','FEEDBACK_REQUIRED'].find(c=>e.message?.includes(c));return json({error:code||(e.code==='PGRST202'?'NOT_CONFIGURED':'UNAVAILABLE')},code==='LOGIN_REQUIRED'?401:code&&['ADMIN_REQUIRED','MFA_REQUIRED','PERMISSION_REQUIRED','FORBIDDEN'].includes(code)?403:code==='NOT_FOUND'?404:code?409:503)}
export async function GET(){try{const db=await authClient();const r=await db.rpc('supplier_product_review',{action:'queue',args:{}});return r.error?failure(r.error):json({reviews:r.data})}catch{return failure({})}}
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 try{const raw=await request.text();if(raw.length>10000)return json({error:'INVALID'},413);let body;try{body=JSON.parse(raw)}catch{return json({error:'INVALID'},400)}const parsed=input.safeParse(body);if(!parsed.success)return json({error:'INVALID'},400);
  const {decision,source,...args}=parsed.data;if(decision==='approve'&&(!source||!/^https?:\/\//i.test(source)))return json({error:'INVALID'},400);
  const db=await authClient();const r=await db.rpc('supplier_product_review',{action:decision,args:{...args,sources:source?[{url:source,title:'Source consultée pour la validation du produit'}]:[]}});
  return r.error?failure(r.error):json(r.data);
 }catch{return failure({})}
}
