import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {transpileModule, ModuleKind, ScriptTarget} from 'typescript';

// Run the actual route with a controlled Auth adapter. No hosted service or real account is used.
const source = await readFile(new URL('../app/api/account/mfa/route.ts', import.meta.url), 'utf8');
const rewritten = source
  .replace("import {authClient} from '@/lib/supabase/server';", 'const authClient = () => globalThis.__accountMfaTestClient;')
  .replace("import {allowedOrigin} from '@/lib/auth-policy';", "const allowedOrigin = request => request.headers.get('origin') === 'https://example.invalid';")
  .replace("from 'zod'", `from '${import.meta.resolve('zod')}'`);
const code = transpileModule(rewritten, {compilerOptions: {module: ModuleKind.ESNext, target: ScriptTarget.ES2022}}).outputText;
const {GET, POST} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const factorId = randomUUID();
const phoneId = randomUUID();
const challengeId = randomUUID();
const confirmedUser = {id: randomUUID(), email: 'member@example.invalid', email_confirmed_at: '2026-01-01T12:00:00Z'};
const totp = {id: factorId, factor_type: 'totp', friendly_name: 'Personal app', status: 'verified', secret: 'not-for-listing'};
const phone = {id: phoneId, factor_type: 'phone', friendly_name: 'Phone', status: 'verified', phone: 'not-for-listing'};
let calls;
let state;
const setClient = (options = {}) => {
  calls = [];
  state = {user: confirmedUser, factors: [], level: 'aal1', ...options};
  const result = (method, data, args) => {
    calls.push({method, args});
    if (state.throwAt === method) throw Error('Provider internals must not leak');
    return {data: state[`${method}Error`] ? null : data, error: state[`${method}Error`] || null};
  };
  globalThis.__accountMfaTestClient = {auth: {
    getUser: async () => {
      const response = result('user', {user: state.user});
      return response.error ? {...response, data: {user: null}} : response;
    },
    mfa: {
      listFactors: async () => result('list', {all: state.factors}),
      getAuthenticatorAssuranceLevel: async () => result('level', {
        currentLevel: state.level,
        nextLevel: state.factors.some(factor => factor.status === 'verified') ? 'aal2' : 'aal1',
      }),
      enroll: async args => {
        const response = result('enroll', {id: factorId, totp: {secret: 'fixture-secret', qr_code: '<svg>fixture</svg>'}}, args);
        if (!response.error) state.factors.push({...totp, status: 'unverified'});
        return response;
      },
      unenroll: async args => {
        const response = result('discard', {id: args.factorId}, args);
        if (!response.error) state.factors = state.factors.filter(factor => factor.id !== args.factorId);
        return response;
      },
      challenge: async args => result('challenge', {id: challengeId}, args),
      verify: async args => {
        const response = result('verify', {access_token: 'must-not-leak', refresh_token: 'must-not-leak'}, args);
        if (!response.error) {
          state.level = 'aal2';
          state.factors = state.factors.map(factor => factor.id === args.factorId ? {...factor, status: 'verified'} : factor);
        }
        return response;
      },
    },
  }};
};
const request = (body = {action: 'enroll'}, headers = {}) => new Request('https://example.invalid/api/account/mfa', {
  method: 'POST', headers: {origin: 'https://example.invalid', 'content-type': 'application/json', ...headers},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const command = {action: 'verify', factor: factorId, code: '123456'};
const check = async (response, status, body) => {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.deepEqual(await response.json(), body);
};
const fail = (response, status, error) => check(response, status, {error});
const mutations = () => calls.filter(call => ['enroll', 'discard', 'challenge', 'verify'].includes(call.method));

for (const user of [null, {...confirmedUser, email_confirmed_at: null}]) {
  setClient({user});
  await fail(await GET(), 401, 'LOGIN_REQUIRED');
  await fail(await POST(request()), 401, 'LOGIN_REQUIRED');
  assert.deepEqual(mutations(), []);
  assert.ok(calls.every(call => call.method === 'user'));
}
setClient();
await fail(await POST(request(command, {origin: 'https://untrusted.invalid'})), 403, 'ORIGIN');
await fail(await POST(request(command, {origin: ''})), 403, 'ORIGIN');
assert.deepEqual(calls, []);

setClient({userError: {name: 'AuthSessionMissingError', status: 400}});
await fail(await GET(), 401, 'LOGIN_REQUIRED');
await fail(await POST(request()), 401, 'LOGIN_REQUIRED');
assert.deepEqual(mutations(), []);
setClient();
for (const body of [
  '{', '', 'x'.repeat(4097), JSON.stringify({action: 'enroll'}).padEnd(4097),
  null, [], {action: 'enroll', role: 'owner'}, {action: 'discard', factor: factorId, code: '123456'},
  {action: 'delete', factor: factorId}, {...command, factor: 'bad'}, {...command, userId: confirmedUser.id},
  {...command, code: '12345'}, {...command, code: '1234567'}, {...command, code: 123456},
  {...command, code: '１２３４５６'}, {...command, code: '12345 '},
]) await fail(await POST(request(body)), 400, 'INVALID');
for (const contentType of ['text/plain', 'application/json-patch+json', 'application/json-extra', '']) {
  await fail(await POST(request(command, {'content-type': contentType})), 400, 'INVALID');
}
await fail(await POST(request(command, {'content-length': '4097'})), 400, 'INVALID');
assert.deepEqual(calls, []);

let cancelled = false;
const chunked = new Request('https://example.invalid/api/account/mfa', {
  method: 'POST', headers: {origin: 'https://example.invalid', 'content-type': 'application/json'}, duplex: 'half',
  body: new ReadableStream({start(controller) {
    controller.enqueue(new TextEncoder().encode('{"action":"enroll","extra":"'));
    controller.enqueue(new Uint8Array(4096));
  }, cancel() {cancelled = true;}}),
});
await fail(await POST(chunked), 400, 'INVALID');
assert.equal(cancelled, true);
assert.deepEqual(calls, []);

setClient({factors: [totp, phone]});
await check(await GET(), 200, {
  email: confirmedUser.email,
  factors: [{id: factorId, name: 'Personal app', status: 'verified'}],
  level: 'aal1', nextLevel: 'aal2',
});
setClient({factors: [{...totp, friendly_name: undefined, status: 'unverified'}]});
await check(await GET(), 200, {
  email: confirmedUser.email, factors: [{id: factorId, name: 'Authenticator', status: 'unverified'}],
  level: 'aal1', nextLevel: 'aal1',
});

// Full setup, reloading the server state, and verification of an existing factor.
setClient();
await check(await POST(request({action: 'enroll'}, {'content-type': 'Application/JSON; charset=utf-8'})), 200, {
  factor: factorId, secret: 'fixture-secret', qrCode: '<svg>fixture</svg>',
});
assert.equal(calls.find(call => call.method === 'enroll').args.factorType, 'totp');
assert.equal(calls.find(call => call.method === 'enroll').args.issuer, 'GSL systems');
await fail(await POST(request()), 409, 'ENROLLMENT_PENDING');
assert.equal(calls.filter(call => call.method === 'enroll').length, 1);
await check(await POST(request(command)), 200, {ok: true});
assert.deepEqual(calls.find(call => call.method === 'challenge').args, {factorId});
assert.deepEqual(calls.find(call => call.method === 'verify').args, {factorId, challengeId, code: '123456'});
await check(await GET(), 200, {
  email: confirmedUser.email, factors: [{id: factorId, name: 'Personal app', status: 'verified'}], level: 'aal2', nextLevel: 'aal2',
});
await check(await POST(request(command)), 200, {ok: true});

// Only an owned, still-unverified TOTP factor may be discarded.
for (const factors of [[], [totp], [{...phone, id: factorId, status: 'unverified'}]]) {
  setClient({factors});
  await fail(await POST(request({action: 'discard', factor: factorId})), 403, 'FORBIDDEN');
  assert.deepEqual(mutations(), []);
}
setClient({factors: [{...totp, status: 'unverified'}]});
await check(await POST(request({action: 'discard', factor: factorId})), 200, {ok: true});
assert.deepEqual(calls.find(call => call.method === 'discard').args, {factorId});
await check(await POST(request()), 200, {factor: factorId, secret: 'fixture-secret', qrCode: '<svg>fixture</svg>'});
for (const factors of [[], [{...phone, id: factorId}]]) {
  setClient({factors});
  await fail(await POST(request(command)), 403, 'FORBIDDEN');
  assert.deepEqual(mutations(), []);
}

// A password-only session cannot create a replacement factor for a protected account.
for (const factors of [[totp], [phone]]) {
  setClient({factors});
  await fail(await POST(request()), 403, 'MFA_REQUIRED');
  assert.deepEqual(mutations(), []);
}
setClient({factors: [phone], level: 'aal2'});
await check(await POST(request()), 200, {factor: factorId, secret: 'fixture-secret', qrCode: '<svg>fixture</svg>'});

for (const [providerError, status, error] of [
  [{code: 'mfa_verification_failed'}, 422, 'CODE_INVALID'],
  [{code: 'mfa_challenge_expired'}, 422, 'CODE_INVALID'],
  [{code: 'over_request_rate_limit'}, 429, 'RATE_LIMITED'],
  [{status: 429}, 429, 'RATE_LIMITED'],
  [{code: 'session_not_found'}, 401, 'LOGIN_REQUIRED'],
  [{status: 401}, 401, 'LOGIN_REQUIRED'],
  [{code: 'insufficient_aal'}, 403, 'MFA_REQUIRED'],
  [{code: 'mfa_factor_not_found'}, 403, 'FORBIDDEN'],
  [{code: 'mfa_verification_rejected'}, 403, 'FORBIDDEN'],
  [{code: 'mfa_ip_address_mismatch'}, 403, 'FORBIDDEN'],
  [{code: 'unexpected_failure', status: 500, message: 'Provider internals must not leak'}, 503, 'UNAVAILABLE'],
  [{message: 'network connection failed'}, 503, 'UNAVAILABLE'],
]) {
  for (const method of ['challenge', 'verify']) {
    setClient({factors: [totp], [`${method}Error`]: providerError});
    await fail(await POST(request(command)), status, error);
    if (method === 'challenge') assert.equal(calls.some(call => call.method === 'verify'), false);
  }
}
for (const providerError of [{code: 'mfa_totp_enroll_not_enabled'}, {code: 'too_many_enrolled_mfa_factors'}, {code: 'mfa_factor_name_conflict'}]) {
  setClient({enrollError: providerError});
  await fail(await POST(request()), 422, 'ENROLLMENT_UNAVAILABLE');
}
for (const method of ['user', 'list', 'level']) {
  setClient({[`${method}Error`]: {status: 503, message: 'Provider internals'}});
  await fail(await GET(), 503, 'UNAVAILABLE');
}
for (const method of ['user', 'list', 'enroll', 'level']) {
  setClient({factors: method === 'level' ? [totp] : [], [`${method}Error`]: {status: 503, message: 'Provider internals'}});
  await fail(await POST(request()), 503, 'UNAVAILABLE');
}
setClient({factors: [{...totp, status: 'unverified'}], discardError: {status: 503}});
await fail(await POST(request({action: 'discard', factor: factorId})), 503, 'UNAVAILABLE');
setClient({throwAt: 'user'});
await fail(await GET(), 503, 'UNAVAILABLE');
setClient({throwAt: 'challenge', factors: [totp]});
await fail(await POST(request(command)), 503, 'UNAVAILABLE');

delete globalThis.__accountMfaTestClient;
console.log('Account MFA checks passed: confirmed sessions, strict bounded input, private responses, owned factors, pending setup restart, AAL2 enrollment, server state refresh and precise safe errors.');
