import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {parsePublishedDescription} from '@/lib/products/spec-fields';
import {boardFamilies,familyCounts,parseLeadTimeDays,rankRequests,OTHER_FAMILY,type BoardRequest,type MakerProfile} from '@/lib/request-board/ranking';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
const notConfigured=(code?:string)=>['PGRST202','PGRST205','42883','42P01','42703'].includes(code||'');
type Raw={signedIn?:boolean;unlocked:boolean;requests:BoardRequest[];maker?:{organizations:{id:string;name:string;country:string}[];products:{category:string;description:string;family:string;minimum_quantity:string;unit:string;lead_time:string;materials:string;processes:string}[];processes:string[];materials:string[];moq:{quantity:number;unit:string}[]}|null};
const split=(s:string)=>s.split(/[,;·\n/]+/).map(x=>x.trim()).filter(x=>x.length>=3);

/** Builds the ranking profile from the manufacturer's own published products and declared capabilities. */
function makerProfile(m:NonNullable<Raw['maker']>):MakerProfile{
 const families=new Set<string>();const processes=new Set(m.processes);const materials=new Set(m.materials);const moq=[...m.moq.map(x=>({quantity:Number(x.quantity),unit:x.unit}))];const leads:number[]=[];
 for(const p of m.products){
  const fam=[p.family,parsePublishedDescription(p.description||'').familyId,p.category].find(f=>(boardFamilies as readonly string[]).includes(f));
  if(fam)families.add(fam);
  split(p.processes).forEach(x=>processes.add(x));split(p.materials).forEach(x=>materials.add(x));
  if(/^\d+(\.\d+)?$/.test(p.minimum_quantity)&&p.unit)moq.push({quantity:Number(p.minimum_quantity),unit:p.unit});
  const d=parseLeadTimeDays(p.lead_time||'');if(d)leads.push(d);
 }
 return {country:m.organizations[0]?.country||'',families:[...families],processes:[...processes],materials:[...materials],moq,leadTimeDays:leads.length?Math.min(...leads):null};
}

export async function GET(request:Request){
 try{
  const db=await authClient();const url=new URL(request.url);
  const caseId=url.searchParams.get('responses');
  if(caseId){if(!z.string().uuid().safeParse(caseId).success)return json({error:'INVALID'},400);const {data,error}=await db.rpc('request_board_responses',{case_uuid:caseId});if(error)return json({error:notConfigured(error.code)?'NOT_CONFIGURED':error.message.includes('MFA')?'MFA_REQUIRED':error.message.includes('PERMISSION')||error.message.includes('ADMIN')||error.message.includes('FORBIDDEN')?'FORBIDDEN':'UNAVAILABLE'},notConfigured(error.code)?503:403);return json({responses:data});}
  const {data,error}=await db.rpc('request_board');
  // A missing function means the database update has not been applied yet: say so instead of showing an empty board.
  if(error)return json({error:notConfigured(error.code)?'NOT_CONFIGURED':'UNAVAILABLE'},503);
  const raw=data as Raw;const now=new Date();
  const requests=raw.requests.map(r=>({...r,total_quantity:r.total_quantity==null?null:Number(r.total_quantity),families:r.families?.length?r.families:[OTHER_FAMILY],items:r.items?.map(i=>({...i,quantity:Number(i.quantity)}))}));
  const maker=raw.unlocked&&raw.maker?makerProfile(raw.maker):null;
  return json({signedIn:!!raw.signedIn,unlocked:raw.unlocked,organizations:raw.maker?.organizations||[],ranked:!!maker,makerFamilies:maker?.families||[],counts:familyCounts(requests),requests:rankRequests(requests,maker,now)});
 }catch{return json({error:'UNAVAILABLE'},503)}
}
const families=z.array(z.enum([...boardFamilies,OTHER_FAMILY] as [string,...string[]])).max(8);
const share=z.object({id:z.string().uuid(),shared:z.boolean(),families:families.optional()}).strict();
const respond=z.object({action:z.literal('respond'),reference:z.string().regex(/^GSL-\d{6}-[A-F0-9]{12}$/),organization:z.string().uuid(),message:z.string().trim().min(20).max(4000),leadTime:z.string().trim().max(200).default('')}).strict();
export async function POST(request:Request){
 if(!allowedOrigin(request))return json({error:'ORIGIN'},403);
 try{
  const db=await authClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
  const raw=await request.text();if(raw.length>20000)return json({error:'INVALID'},413);
  let body:unknown;try{body=JSON.parse(raw)}catch{return json({error:'INVALID'},400)}
  const isRespond=!!body&&typeof body==='object'&&(body as {action?:string}).action==='respond';
  let result;
  if(isRespond){const p=respond.safeParse(body);if(!p.success)return json({error:'INVALID'},422);result=await db.rpc('respond_to_board_request',{request_reference:p.data.reference,organization:p.data.organization,message:p.data.message,lead_time:p.data.leadTime});}
  else{const p=share.safeParse(body);if(!p.success)return json({error:'INVALID'},422);result=p.data.families?await db.rpc('set_request_board',{case_uuid:p.data.id,shared:p.data.shared,families:p.data.families}):await db.rpc('share_request_on_board',{case_uuid:p.data.id,shared:p.data.shared});}
  const {data,error}=result;
  if(error){const code=['FORBIDDEN','CONFLICT','LOGIN_REQUIRED','NOT_FOUND','INVALID'].find(k=>error.message.includes(k));return json({error:code||(notConfigured(error.code)?'NOT_CONFIGURED':'UNAVAILABLE')},code==='FORBIDDEN'?403:code==='CONFLICT'?409:code==='NOT_FOUND'?404:code==='INVALID'?422:code?401:503);}
  return json({ok:true,result:data});
 }catch{return json({error:'UNAVAILABLE'},503)}
}
