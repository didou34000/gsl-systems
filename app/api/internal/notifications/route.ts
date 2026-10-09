import {timingSafeEqual} from 'node:crypto';
import {notificationConfigStatus,processNotifications} from '@/lib/notifications/worker';
import {templateVersion} from '@/lib/notifications/templates';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
function authorized(request:Request){
 const secret=process.env.GSL_WORKER_SECRET,provided=request.headers.get('authorization')||'',expected='Bearer '+secret;
 return !!secret&&Buffer.byteLength(provided)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(provided),Buffer.from(expected));
}
export async function GET(request:Request){
 if(!authorized(request))return json({error:'FORBIDDEN'},403);
 return json({configuration:notificationConfigStatus(),templateVersion,deliveryAttempted:false});
}
export async function POST(request:Request){
 if(!authorized(request))return json({error:'FORBIDDEN'},403);
 const configuration=notificationConfigStatus();
 if(!configuration.ready)return json({error:'NOTIFICATIONS_NOT_CONFIGURED',configuration},503);
 try{return json(await processNotifications())}catch{return json({error:'NOTIFICATIONS_UNAVAILABLE'},503)}
}
