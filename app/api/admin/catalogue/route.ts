import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {notificationConfigStatus} from '@/lib/notifications/worker';
import type {CatalogueErrorCode} from '@/lib/admin/catalogue-types';
import {catalogueMutationSchema, readCatalogueJson} from './validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const headers = {'Cache-Control': 'private, no-store', Vary: 'Cookie'};
const json = (value: unknown, status = 200) => Response.json(value, {status, headers});
const failure = (error: CatalogueErrorCode, status: number) => json({error, errorCode: error}, status);

function databaseFailure(error: {message: string; code?: string}) {
  const statuses: Partial<Record<CatalogueErrorCode, number>> = {
    LOGIN_REQUIRED: 401, ADMIN_REQUIRED: 403, OWNER_REQUIRED: 403, PERMISSION_REQUIRED: 403,
    MFA_REQUIRED: 403, EMAIL_UNCONFIRMED: 403, USER_INACTIVE: 403,
    INVALID: 400, CONFLICT: 409, NOT_FOUND: 404,
  };
  const status = statuses[error.message as CatalogueErrorCode];
  if (status) return failure(error.message as CatalogueErrorCode, status);
  if (error.code === 'PGRST202' || error.code === '42883') return failure('NOT_CONFIGURED', 503);
  if (error.code?.startsWith('22')) return failure('INVALID', 400);
  return failure('UNAVAILABLE', 503);
}

function emailConfigurationPresent() {
  return notificationConfigStatus().ready;
}

export async function GET() {
  try {
    const db = await authClient();
    const {data: auth, error: authError} = await db.auth.getUser();
    if (authError || !auth.user) return failure('LOGIN_REQUIRED', 401);
    // The RPC rechecks active, confirmed owner status and the session's AAL2 claim.
    const {data, error} = await db.rpc('admin_catalogue_snapshot');
    if (error) return databaseFailure(error);
    if (!data || data.canManage !== true || !Array.isArray(data.companies)
      || !Array.isArray(data.products) || !Array.isArray(data.recipients)
      || !data.notificationStatus) return failure('UNAVAILABLE', 503);
    return json({...data, emailConfigured: emailConfigurationPresent()});
  } catch {return failure('UNAVAILABLE', 503);}
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return failure('ORIGIN', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return failure('INVALID', 400);
  }
  try {
    const db = await authClient();
    const {data: auth, error: authError} = await db.auth.getUser();
    if (authError || !auth.user) return failure('LOGIN_REQUIRED', 401);
    let input: unknown;
    try {input = await readCatalogueJson(request);} catch {return failure('INVALID', 400);}
    const parsed = catalogueMutationSchema.safeParse(input);
    if (!parsed.success) return failure('INVALID', 400);
    const {data, error} = await db.rpc('admin_catalogue_mutate', {input: parsed.data});
    if (error) return databaseFailure(error);
    if (!data || data.saved !== true || !Number.isSafeInteger(data.revision)) return failure('UNAVAILABLE', 503);
    return json({saved: true, revision: data.revision});
  } catch {return failure('UNAVAILABLE', 503);}
}
