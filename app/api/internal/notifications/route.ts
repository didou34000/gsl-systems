import {timingSafeEqual} from 'node:crypto';
import {processNotifications} from '@/lib/notifications/worker';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(request:Request){const secret=process.env.GSL_WORKER_SECRET;const provided=request.headers.get('authorization')||'';const expected='Bearer '+secret;
 if(!secret||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return Response.json({error:'FORBIDDEN'},{status:403});
 try{return Response.json(await processNotifications(),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'NOTIFICATIONS_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
