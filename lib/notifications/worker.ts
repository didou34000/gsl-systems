import nodemailer from 'nodemailer';
import {createClient} from '@supabase/supabase-js';
import {runtimeConfig} from '@/lib/runtime-config';
import {notificationTemplate,templateVersion} from './templates';

const required=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','GSL_ENVIRONMENT','GSL_SITE_URL','GSL_SMTP_HOST','GSL_SMTP_USER','GSL_SMTP_PASSWORD','GSL_EMAIL_FROM'] as const;
const emailPattern=/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Presence/format only: no connection, secret values, queue mutation or send. */
export function notificationConfigStatus(env:NodeJS.ProcessEnv=process.env){
 const missing:string[]=required.filter(name=>!env[name]?.trim()),invalid:string[]=[];
 const authorization={manual:!!env.GSL_WORKER_SECRET?.trim(),cron:!!env.CRON_SECRET?.trim()};
 if(!authorization.manual&&!authorization.cron)missing.push('WORKER_AUTHORIZATION');
 const enabled=env.GSL_TRANSACTIONAL_EMAIL_ENABLED==='true';
 if(env.GSL_EMAIL_FROM&&!emailPattern.test(env.GSL_EMAIL_FROM))invalid.push('GSL_EMAIL_FROM');
 if(env.GSL_SMTP_HOST&&!/^[a-z0-9][a-z0-9.-]*$/i.test(env.GSL_SMTP_HOST))invalid.push('GSL_SMTP_HOST');
 const port=Number(env.GSL_SMTP_PORT||465);if(!Number.isInteger(port)||port<1||port>65535)invalid.push('GSL_SMTP_PORT');
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(key){
  let privileged=key.startsWith('sb_secret_')&&key.length>20;
  if(!privileged&&key.split('.').length===3){try{privileged=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8')).role==='service_role'}catch{/* Invalid legacy key. */}}
  if(!privileged||key===env.SUPABASE_PUBLISHABLE_KEY)invalid.push('SUPABASE_SERVICE_ROLE_KEY');
 }
 if(!missing.some(name=>['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','GSL_ENVIRONMENT','GSL_SITE_URL'].includes(name))){
  try{runtimeConfig(env)}catch{invalid.push('RUNTIME_CONFIGURATION')}
 }
 const configured=missing.length===0&&invalid.length===0;
 return {enabled,configured,ready:enabled&&configured,status:!enabled?'disabled':configured?'ready':'not_configured',missing,invalid,authorization};
}

export function notificationConfig(env:NodeJS.ProcessEnv=process.env){
 if(!notificationConfigStatus(env).ready)throw Error('NOTIFICATIONS_NOT_CONFIGURED');
 return {...runtimeConfig(env),secret:env.SUPABASE_SERVICE_ROLE_KEY!,host:env.GSL_SMTP_HOST!,port:Number(env.GSL_SMTP_PORT||465),user:env.GSL_SMTP_USER!,password:env.GSL_SMTP_PASSWORD!,from:env.GSL_EMAIL_FROM!};
}

type Job={id:string;attempts:number;email:string;template:string;language:string;resource_id:string};
type DeliveryError={code?:string;command?:string;message?:string};
const safeConnectionRetry=(error:DeliveryError)=>error.code==='EDNS'||(['ECONNECTION','ETIMEDOUT','ESOCKET'].includes(error.code||'')&&['CONN','EHLO','HELO','STARTTLS','AUTH'].includes(error.command||''));

export async function processNotifications(){
 // Configuration must be complete before the worker can lease even one job.
 const c=notificationConfig();
 const db=createClient(c.url,c.secret,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)})}});
 const transport=nodemailer.createTransport({host:c.host,port:c.port,secure:c.port===465,requireTLS:true,auth:{user:c.user,pass:c.password},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:15000});
 const lease=crypto.randomUUID();
 let accepted=0,acknowledged=0,failed=0,retryScheduled=0,uncertain=0;
 const finish=async(job:Job,outcome:'accepted'|'retry'|'failed',reference:string|null,failureCode:string|null)=>{
  try{const result=await db.rpc('finish_notification',{job_id:job.id,lease_id:lease,outcome,provider_reference:reference,failure_code:failureCode});return !result.error}catch{return false}
 };
 try{
  const {data,error}=await db.rpc('claim_notifications',{lease_id:lease});if(error||!Array.isArray(data))throw Error('QUEUE_UNAVAILABLE');
  const jobs=data as Job[];
  for(const job of jobs){
   let deliveryAttempted=false;
   try{
    if(!uuidPattern.test(job.id)||!uuidPattern.test(job.resource_id)||!emailPattern.test(job.email)||job.email.length>254)throw Error('RECIPIENT_INVALID');
    const template=notificationTemplate(job.template,job.language,c.siteUrl,job.resource_id);
    deliveryAttempted=true;
    const result=await transport.sendMail({from:{name:'GSL systems',address:c.from},to:job.email,subject:template.subject,text:template.text,html:template.html,messageId:`<${job.id}@${c.from.split('@')[1]}>`,headers:{'X-GSL-Template':templateVersion}});
    if(!result.accepted?.length)throw Error('RECIPIENT_REJECTED');
    accepted++;
    if(await finish(job,'accepted',String(result.messageId),null))acknowledged++;
    else uncertain++; // Leave the lease for manual/expiry reconciliation; never resend an SMTP acceptance.
   }catch(error){
    const caught=error as DeliveryError,safeRetry=deliveryAttempted&&safeConnectionRetry(caught),retryAllowed=safeRetry&&Number.isInteger(job.attempts)&&job.attempts<5;
    const knownRejection=['EAUTH','EENVELOPE'].includes(caught.code||'')||caught.message==='RECIPIENT_REJECTED';
    const code=!deliveryAttempted?'INVALID_NOTIFICATION':safeRetry?'CONNECTION_FAILED':knownRejection?'SMTP_REJECTED':'DELIVERY_UNCERTAIN';
    const saved=await finish(job,retryAllowed?'retry':'failed',null,code);
    if(retryAllowed&&saved)retryScheduled++;else failed++;
    if(!saved||(deliveryAttempted&&!safeRetry&&!knownRejection))uncertain++;
   }
  }
  return {processed:jobs.length,accepted,acknowledged,failed,retryScheduled,uncertain};
 }finally{transport.close()}
}
