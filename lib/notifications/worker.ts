import nodemailer from 'nodemailer';
import {createClient} from '@supabase/supabase-js';
import {runtimeConfig} from '@/lib/runtime-config';
import {notificationTemplate,templateVersion} from './templates';
export function notificationConfig(){const config=runtimeConfig();const e=process.env;
 if(e.GSL_TRANSACTIONAL_EMAIL_ENABLED!=='true'||!e.SUPABASE_SERVICE_ROLE_KEY||!e.GSL_SMTP_HOST||!e.GSL_SMTP_USER||!e.GSL_SMTP_PASSWORD||!e.GSL_EMAIL_FROM)throw Error('NOTIFICATIONS_NOT_CONFIGURED');
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(e.GSL_EMAIL_FROM))throw Error('EMAIL_FROM_INVALID');
 return {...config,secret:e.SUPABASE_SERVICE_ROLE_KEY,host:e.GSL_SMTP_HOST,port:Number(e.GSL_SMTP_PORT||465),user:e.GSL_SMTP_USER,password:e.GSL_SMTP_PASSWORD,from:e.GSL_EMAIL_FROM};
}
export async function processNotifications(){
 const c=notificationConfig();const db=createClient(c.url,c.secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const transport=nodemailer.createTransport({host:c.host,port:c.port,secure:c.port===465,requireTLS:true,auth:{user:c.user,pass:c.password},connectionTimeout:10000,socketTimeout:20000});
 const lease=crypto.randomUUID();const {data,error}=await db.rpc('claim_notifications',{lease_id:lease});if(error)throw Error('QUEUE_UNAVAILABLE');
 const jobs=(data||[]) as {id:string;email:string;template:string;language:string;resource_id:string}[];let accepted=0,failed=0;
 for(const job of jobs){try{const template=notificationTemplate(job.template,job.language,c.siteUrl,job.resource_id);const result=await transport.sendMail({from:{name:'GSL systems',address:c.from},to:job.email,subject:template.subject,text:template.text,html:template.html,messageId:`<${job.id}@${c.from.split('@')[1]}>`,headers:{'X-GSL-Template':templateVersion}});
 if(!result.accepted?.length)throw Error('RECIPIENT_REJECTED');
 const {error:saveError}=await db.rpc('finish_notification',{job_id:job.id,lease_id:lease,outcome:'accepted',provider_reference:String(result.messageId),failure_code:null});if(saveError)throw Error('ACKNOWLEDGEMENT_UNCERTAIN');accepted++;
 }catch(e){const err=e as {code?:string;command?:string;message?:string};const safeRetry=['ECONNECTION','EDNS','ETIMEDOUT'].includes(err.code||'')&&!['DATA','CONN'].includes(err.command||'');await db.rpc('finish_notification',{job_id:job.id,lease_id:lease,outcome:safeRetry?'retry':'failed',provider_reference:null,failure_code:safeRetry?'CONNECTION_FAILED':'DELIVERY_UNCERTAIN_OR_REJECTED'});failed++;}}
 transport.close();return {processed:jobs.length,accepted,failed};
}
