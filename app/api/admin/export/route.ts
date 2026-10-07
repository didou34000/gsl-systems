import {z} from 'zod';
import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {adminExportCsv} from '@/lib/admin/export';
import {isLanguage} from '@/lib/i18n/languages';
import type {AdminErrorCode, AdminExportResult} from '@/lib/admin/types';

const headers = {'Cache-Control':'private, no-store', Vary:'Cookie', 'X-Content-Type-Options':'nosniff'};
const failure = (error: AdminErrorCode, status: number) => Response.json({error,errorCode:error},{status,headers});
const schema = z.object({
  resource:z.enum(['overview','companies','products','contacts','activity','tasks']),
  language:z.string().refine(isLanguage),
}).strict();

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return failure('ORIGIN',403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return failure('INVALID',400);
  try {
    const db = await authClient();
    const {data:auth,error:authError} = await db.auth.getUser();
    if (authError || !auth.user) return failure('LOGIN_REQUIRED',401);
    const text = await request.text();
    if (text.length > 2048) return failure('INVALID',400);
    let body:unknown;
    try {body=JSON.parse(text);} catch {return failure('INVALID',400);}
    const parsed=schema.safeParse(body);
    if (!parsed.success || !isLanguage(parsed.data.language)) return failure('INVALID',400);
    // This RPC checks live role/MFA and records the export before returning bounded rows.
    const {data,error}=await db.rpc('admin_export',{input:{resource:parsed.data.resource}});
    if (error) {
      const codes:Partial<Record<AdminErrorCode,number>>={LOGIN_REQUIRED:401,ADMIN_REQUIRED:403,MFA_REQUIRED:403,PERMISSION_REQUIRED:403,INVALID:400};
      if (codes[error.message as AdminErrorCode]) return failure(error.message as AdminErrorCode,codes[error.message as AdminErrorCode]!);
      return failure(error.code==='PGRST202'||error.code==='42883'?'NOT_CONFIGURED':'UNAVAILABLE',503);
    }
    const result=data as AdminExportResult;
    if (!result || result.resource!==parsed.data.resource || !Array.isArray(result.rows) || result.rows.length>5000 || result.rows.some(row=>!row || typeof row!=='object' || Array.isArray(row))) return failure('UNAVAILABLE',503);
    const filename=`gsl-admin-${parsed.data.resource}-${new Date().toISOString().slice(0,10)}.csv`;
    return new Response(adminExportCsv(result,parsed.data.language),{headers:{...headers,
      'Content-Type':'text/csv; charset=utf-8',
      'Content-Disposition':`attachment; filename="${filename}"`,
      'X-Export-Truncated':result.truncated?'true':'false',
      'X-Export-Row-Count':String(result.rows.length),
    }});
  } catch {return failure('UNAVAILABLE',503);}
}
