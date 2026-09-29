import 'server-only';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {runtimeConfig} from '@/lib/runtime-config';
export function scanningAvailable(){return Boolean(process.env.GSL_SCAN_URL&&process.env.GSL_SCAN_TOKEN&&process.env.SUPABASE_SERVICE_ROLE_KEY)}
/** The configured processor must scan bytes and echo their SHA-256 digest.
 * Missing credentials, timeouts and inconclusive results leave the file pending. */
export async function scanRequestFile(id:string,bytes:Uint8Array){
 if(!scanningAvailable())return 'pending';
 const url=new URL(process.env.GSL_SCAN_URL!);if(url.protocol!=='https:')throw Error('SCAN_CONFIGURATION');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+process.env.GSL_SCAN_TOKEN,'Content-Type':'application/octet-stream','X-Content-SHA256':sha256},body:Buffer.from(bytes),signal:AbortSignal.timeout(20000),redirect:'error',cache:'no-store'});
 if(!response.ok)return 'pending';
 const result=await response.json() as {sha256?:string;verdict?:string};if(result.sha256!==sha256||!['clean','rejected'].includes(result.verdict||''))return 'pending';
 const {url:supabaseUrl}=runtimeConfig();const db=createClient(supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await db.rpc('record_file_scan',{file_id:id,verdict:result.verdict});if(error)throw Error('SCAN_RECORD_FAILED');return result.verdict;
}
