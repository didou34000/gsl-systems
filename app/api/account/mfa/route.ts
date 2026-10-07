import {authClient} from '@/lib/supabase/server';
import {allowedOrigin} from '@/lib/auth-policy';
import {z} from 'zod';

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', Vary: 'Cookie'},
});
const failure = (error: string, status: number) => json({error}, status);
const inputSchema = z.discriminatedUnion('action', [
  z.object({action: z.literal('enroll')}).strict(),
  z.object({action: z.literal('discard'), factor: z.string().uuid()}).strict(),
  z.object({action: z.literal('verify'), factor: z.string().uuid(), code: z.string().regex(/^\d{6}$/)}).strict(),
]);

function authFailure(error: {code?: string; status?: number; name?: string}) {
  if (error.status === 429 || error.code === 'over_request_rate_limit') return failure('RATE_LIMITED', 429);
  if (error.status === 401 || error.name === 'AuthSessionMissingError' || ['bad_jwt', 'session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'user_not_found', 'user_banned'].includes(error.code || '')) return failure('LOGIN_REQUIRED', 401);
  if (error.code === 'insufficient_aal') return failure('MFA_REQUIRED', 403);
  if (['mfa_factor_not_found', 'mfa_ip_address_mismatch', 'mfa_verification_rejected'].includes(error.code || '')) return failure('FORBIDDEN', 403);
  if (['mfa_verification_failed', 'mfa_challenge_expired'].includes(error.code || '')) return failure('CODE_INVALID', 422);
  if (['mfa_totp_enroll_not_enabled', 'too_many_enrolled_mfa_factors', 'mfa_factor_name_conflict'].includes(error.code || '')) return failure('ENROLLMENT_UNAVAILABLE', 422);
  return failure('UNAVAILABLE', 503);
}

// Bound the stream before parsing, including requests without Content-Length.
async function readInput(request: Request): Promise<unknown> {
  const maxBytes = 4096;
  if (Number(request.headers.get('content-length')) > maxBytes || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, {stream: true});
    }
    body += decoder.decode();
    return JSON.parse(body);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function GET() {
  try {
    const db = await authClient();
    const {data: {user}, error: authError} = await db.auth.getUser();
    if (authError) return authFailure(authError);
    if (!user?.email_confirmed_at) return failure('LOGIN_REQUIRED', 401);
    const [factors, level] = await Promise.all([
      db.auth.mfa.listFactors(),
      db.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factors.error) return authFailure(factors.error);
    if (level.error) return authFailure(level.error);
    return json({
      email: user.email || '',
      factors: factors.data.all.filter(factor => factor.factor_type === 'totp').map(factor => ({
        id: factor.id, name: factor.friendly_name || 'Authenticator', status: factor.status,
      })),
      level: level.data.currentLevel,
      nextLevel: level.data.nextLevel,
    });
  } catch {
    return failure('UNAVAILABLE', 503);
  }
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return failure('ORIGIN', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return failure('INVALID', 400);
  try {
    const parsed = inputSchema.safeParse(await readInput(request));
    if (!parsed.success) return failure('INVALID', 400);
    const db = await authClient();
    const {data: {user}, error: authError} = await db.auth.getUser();
    if (authError) return authFailure(authError);
    if (!user?.email_confirmed_at) return failure('LOGIN_REQUIRED', 401);

    const listed = await db.auth.mfa.listFactors();
    if (listed.error) return authFailure(listed.error);
    const factors = listed.data.all.filter(factor => factor.factor_type === 'totp');

    if (parsed.data.action === 'enroll') {
      if (listed.data.all.some(factor => factor.status === 'verified')) {
        const level = await db.auth.mfa.getAuthenticatorAssuranceLevel();
        if (level.error) return authFailure(level.error);
        if (level.data.currentLevel !== 'aal2') return failure('MFA_REQUIRED', 403);
      }
      if (factors.some(factor => factor.status === 'unverified')) return failure('ENROLLMENT_PENDING', 409);
      const result = await db.auth.mfa.enroll({factorType: 'totp', friendlyName: 'GSL ' + new Date().toISOString(), issuer: 'GSL systems'});
      if (result.error) return authFailure(result.error);
      return json({factor: result.data.id, secret: result.data.totp.secret, qrCode: result.data.totp.qr_code});
    }

    const factorId = parsed.data.factor;
    const factor = factors.find(item => item.id === factorId);
    if (!factor) return failure('FORBIDDEN', 403);
    if (parsed.data.action === 'discard') {
      if (factor.status !== 'unverified') return failure('FORBIDDEN', 403);
      const result = await db.auth.mfa.unenroll({factorId});
      return result.error ? authFailure(result.error) : json({ok: true});
    }

    const challenge = await db.auth.mfa.challenge({factorId});
    if (challenge.error) return authFailure(challenge.error);
    const verified = await db.auth.mfa.verify({factorId, challengeId: challenge.data.id, code: parsed.data.code});
    if (verified.error) return authFailure(verified.error);
    return json({ok: true});
  } catch {
    return failure('UNAVAILABLE', 503);
  }
}
