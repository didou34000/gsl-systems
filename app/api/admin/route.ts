import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {adminMutationSchema} from './validation';
import type {AdminErrorCode} from '@/lib/admin/types';

const headers = {'Cache-Control': 'private, no-store', Vary: 'Cookie'};
const json = (value: unknown, status = 200) => Response.json(value, {status, headers});
const failure = (error: AdminErrorCode, status: number) => json({error, errorCode: error}, status);

function databaseFailure(error: {message: string; code?: string}) {
  const statuses: Partial<Record<AdminErrorCode, number>> = {
    LOGIN_REQUIRED: 401, ADMIN_REQUIRED: 403, MFA_REQUIRED: 403, INVALID: 400,
    CONFLICT: 409, NOT_FOUND: 404, LIMIT_REACHED: 409,
    PERMISSION_REQUIRED: 403, SELF_ACCESS_CHANGE: 403, LAST_OWNER: 409,
    USER_NOT_FOUND: 404, EMAIL_UNCONFIRMED: 409, ALREADY_GRANTED: 409,
    USER_INACTIVE: 409,
  };
  const status = statuses[error.message as AdminErrorCode];
  if (status) return failure(error.message as AdminErrorCode, status);
  if (error.code === 'PGRST202' || error.code === '42883') return failure('NOT_CONFIGURED', 503);
  if (error.code?.startsWith('22')) return failure('INVALID', 400);
  return failure('UNAVAILABLE', 503);
}

export async function GET() {
  try {
    const db = await authClient();
    const {data: auth, error: authError} = await db.auth.getUser();
    if (authError || !auth.user) return failure('LOGIN_REQUIRED', 401);
    const {data, error} = await db.rpc('admin_snapshot');
    return error ? databaseFailure(error) : json(data);
  } catch {
    return failure('UNAVAILABLE', 503);
  }
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return failure('ORIGIN', 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return failure('INVALID', 400);
  try {
    const db = await authClient();
    const {data: auth, error: authError} = await db.auth.getUser();
    if (authError || !auth.user) return failure('LOGIN_REQUIRED', 401);
    const body = await request.text();
    if (body.length > 100000) return failure('INVALID', 400);
    let input: unknown;
    try {input = JSON.parse(body);} catch {return failure('INVALID', 400);}
    const parsed = adminMutationSchema.safeParse(input);
    if (!parsed.success) return failure('INVALID', 400);
    const {data, error} = await db.rpc('admin_mutate', {input: parsed.data});
    return error ? databaseFailure(error) : json(data);
  } catch {
    return failure('UNAVAILABLE', 503);
  }
}
