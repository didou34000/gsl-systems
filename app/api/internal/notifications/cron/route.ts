import {timingSafeEqual} from 'node:crypto';
import {notificationConfigStatus,processNotifications} from '@/lib/notifications/worker';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

// Vercel Cron sends GET with Authorization: Bearer CRON_SECRET. This route is
// separate from the read-only worker status endpoint and never trusts User-Agent.
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,provided=request.headers.get('authorization')||'',expected='Bearer '+secret;
 if(!secret||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return json({error:'FORBIDDEN'},403);
 const configuration=notificationConfigStatus();
 if(!configuration.ready)return json({error:'NOTIFICATIONS_NOT_CONFIGURED',configuration},503);
 try{return json(await processNotifications())}catch{return json({error:'NOTIFICATIONS_UNAVAILABLE'},503)}
}

// A status/availability probe must not inherit GET's side effects.
export function HEAD(){return new Response(null,{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}})}
