import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database} from '@/db/raw';
import {handleBusiness} from '@/lib/b2b/api';
export const dynamic='force-dynamic';
async function handle(request:Request){return handleBusiness(request,{db:database(),user:await getChatGPTUser(),reviewerIds:((env as unknown as {CD_REVIEWER_USER_IDS?:string}).CD_REVIEWER_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean)})}
export const GET=handle;
export const POST=handle;
