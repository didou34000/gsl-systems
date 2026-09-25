import {publicDeployment, unavailableWorkspace} from '@/lib/hosting';
import {env} from 'cloudflare:workers';
import {database} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {handleFiles} from '@/lib/b2b/files';
export const dynamic='force-dynamic';
async function handle(request:Request){if(publicDeployment){return unavailableWorkspace();}const config=env as unknown as {FILES?:R2Bucket;CD_REVIEWER_USER_IDS?:string};return handleFiles(request,{db:database(),bucket:config.FILES,user:await getChatGPTUser(),reviewerIds:(config.CD_REVIEWER_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean)})}
export const GET=handle;export const POST=handle;
