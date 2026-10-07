// Local, fictional MFA fixtures. No real sessions, accounts or authenticator factors are used.
// Run with Next on 5173: node scripts/serve-security-fixtures.mjs
// Override only loopback targets: NEXT_FIXTURE_TARGET=http://127.0.0.1:5173
// Visit /compte/securite?next=%2Fadministration&lang=fr&fixture=setup on port 5190.
// Scenarios: setup, verify, pending, mixed, success, guest, unavailable, ratelimited.
// Switching scenarios resets that browser's fixture; reloading the same one preserves it.
// A fresh browser cookie starts an independent fixture. Only the test code 123456 succeeds.
import http from 'node:http';
import {randomUUID} from 'node:crypto';

const databaseVariables = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
if (databaseVariables.some(name => process.env[name])) throw Error('External database configuration refused');
const target = new URL(process.env.NEXT_FIXTURE_TARGET || 'http://127.0.0.1:5173');
if (target.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
  throw Error('NEXT_FIXTURE_TARGET must be an HTTP loopback origin');
}
const port = 5190;
if (target.port === String(port)) throw Error('Fixture target cannot point to this proxy');
const cookieName = 'gsl-security-fixture';
const scenarios = new Set(['setup', 'verify', 'pending', 'mixed', 'success', 'guest', 'unavailable', 'ratelimited']);
const sessions = new Map();
const sessionTtl = 60 * 60 * 1000;
const fakeEmail = 'security-test@example.invalid';
const fakeSecret = 'JBSWY3DPEHPK3PXP';
const permissions = ['overview.read', 'catalog.read', 'contacts.read', 'contacts.manage', 'tasks.manage', 'activity.read', 'data.export', 'access.manage'];

function factor(status) {
  return {id: randomUUID(), name: status === 'verified' ? 'Application de test · configurée' : 'Application de test · à terminer', status};
}

function newState(scenario) {
  const verified = ['verify', 'mixed', 'success', 'ratelimited'].includes(scenario);
  return {
    id: randomUUID(), scenario, signedIn: scenario !== 'guest', updatedAt: Date.now(), userId: randomUUID(),
    factors: [...(verified ? [factor('verified')] : []), ...(['pending', 'mixed'].includes(scenario) ? [factor('unverified')] : [])],
    level: scenario === 'success' ? 'aal2' : 'aal1',
  };
}

function sessionFor(req, url) {
  for (const [id, value] of sessions) if (Date.now() - value.updatedAt > sessionTtl) sessions.delete(id);
  const id = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  let state = sessions.get(id);
  const requested = url.searchParams.get('fixture');
  if (requested && !scenarios.has(requested)) return null;
  if (!state || (requested && requested !== state.scenario)) {
    if (state) sessions.delete(state.id);
    if (sessions.size >= 500) sessions.delete(sessions.keys().next().value);
    state = newState(requested || 'setup');
    sessions.set(state.id, state);
  }
  state.updatedAt = Date.now();
  return state;
}

function mfaSnapshot(state) {
  return {
    email: fakeEmail,
    factors: state.factors.map(item => ({...item})),
    level: state.level,
    nextLevel: state.factors.some(item => item.status === 'verified') ? 'aal2' : 'aal1',
  };
}

function adminSnapshot(state) {
  return {
    viewer: {id: state.userId, email: fakeEmail, reviewer: true, role: 'owner', permissions},
    generatedAt: new Date().toISOString(), revision: 0,
    stats: {users: 1, companies: 0, publishedCompanies: 0, products: 0, publishedProducts: 0, openContacts: 0, pendingApplications: 0, pendingEmails: 0, failedEmails: 0, conversations: 0},
    trend: [], companies: [], products: [], contacts: [], activity: [], tasks: [],
    preferences: {widgetOrder: ['activity', 'tasks', 'contacts', 'catalog']},
    access: {revision: 0, members: [{userId: state.userId, email: fakeEmail, role: 'owner', grantedAt: new Date().toISOString(), updatedAt: new Date().toISOString()}], events: [], truncated: false},
    limits: {companies: 1000, products: 1000, contacts: 500, activity: 100},
    totals: {companies: 0, products: 0, contacts: 0, activity: 0},
  };
}

// Deliberately labelled and non-scannable: visual tests must not enroll a real authenticator.
const fakeQr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="white"/><g fill="none" stroke="#25362e" stroke-width="8"><path d="M24 24h48v48H24zM168 24h48v48h-48zM24 142h48v48H24z"/><path stroke-width="12" d="M42 42h12v12H42zM186 42h12v12h-12zM42 160h12v12H42z"/></g><path fill="#25362e" d="M92 24h12v24H92zM116 24h24v12h-24zM104 60h36v12h-36zM24 92h24v12H24zM60 92h12v24H60zM92 84h12v12H92zM140 84h24v24h-24zM180 96h36v12h-36zM92 148h12v24H92zM116 160h24v12h-24zM140 140h12v12h-12zM168 148h24v12h-24zM192 172h24v18h-24z"/><rect x="16" y="108" width="208" height="30" fill="white"/><text x="120" y="129" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="#a74c37">LOCAL TEST</text><text x="120" y="220" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#56665d">CODE: 123456</text></svg>';
const qrCode = 'data:image/svg+xml;base64,' + Buffer.from(fakeQr).toString('base64');

function reply(res, value, status = 200, extraHeaders = {}) {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', ...extraHeaders});
  res.end(JSON.stringify(value));
}

async function readBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 4096) throw Error('INVALID');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Error('INVALID'); }
}

function fixtureOrigin(req) {
  return ['http://127.0.0.1:' + port, 'http://localhost:' + port].includes(req.headers.origin);
}

async function api(req, res, url, state) {
  const user = {email: fakeEmail, name: 'Compte de test local', confirmed: true, language: 'fr'};
  if (url.pathname === '/api/auth' && req.method === 'GET') return reply(res, {user: state.signedIn ? user : null});
  if (url.pathname === '/api/auth' && req.method === 'POST') {
    if (!fixtureOrigin(req)) return reply(res, {error: 'ORIGIN'}, 403);
    const body = await readBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || body.action !== 'logout') return reply(res, {error: 'FIXTURE_ROUTE_NOT_IMPLEMENTED'}, 404);
    state.signedIn = false;
    state.factors = [];
    state.level = 'aal1';
    return reply(res, {ok: true});
  }
  if (!state.signedIn) return reply(res, {error: 'LOGIN_REQUIRED'}, 401);
  if (state.scenario === 'unavailable') return reply(res, {error: 'UNAVAILABLE'}, 503);
  if (req.method === 'GET') {
    if (url.pathname === '/api/account/mfa') return reply(res, mfaSnapshot(state));
    if (url.pathname === '/api/workspace') return reply(res, {user, favorites: [], drafts: []});
    if (url.pathname === '/api/member') return reply(res, {administration: true, user, favorites: 0, requests: [], conversations: [], organizations: [], application: null});
    if (url.pathname === '/api/admin') return state.level === 'aal2' ? reply(res, adminSnapshot(state)) : reply(res, {error: 'MFA_REQUIRED'}, 403);
  }
  if (url.pathname !== '/api/account/mfa' || req.method !== 'POST') return reply(res, {error: 'FIXTURE_ROUTE_NOT_IMPLEMENTED'}, 404);
  if (!fixtureOrigin(req)) return reply(res, {error: 'ORIGIN'}, 403);
  const body = await readBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(res, {error: 'INVALID'}, 400);
  if (body.action === 'enroll') {
    const item = factor('unverified');
    state.factors.push(item);
    return reply(res, {factor: item.id, secret: fakeSecret, qrCode});
  }
  const item = state.factors.find(value => value.id === body.factor);
  if (body.action === 'discard') {
    if (!item || item.status !== 'unverified') return reply(res, {error: 'FORBIDDEN'}, 403);
    state.factors = state.factors.filter(value => value.id !== item.id);
    return reply(res, {ok: true});
  }
  if (body.action === 'verify') {
    if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) return reply(res, {error: 'INVALID'}, 400);
    if (state.scenario === 'ratelimited') return reply(res, {error: 'RATE_LIMITED'}, 429, {'Retry-After': '30'});
    if (!item || body.code !== '123456') return reply(res, {error: 'CODE_INVALID'}, 422);
    item.status = 'verified';
    item.name = 'Application de test · configurée';
    state.level = 'aal2';
    return reply(res, {ok: true});
  }
  return reply(res, {error: 'INVALID'}, 400);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!['127.0.0.1:' + port, 'localhost:' + port].includes(req.headers.host)) return reply(res, {error: 'LOCALHOST_REQUIRED'}, 403);
    const url = new URL(req.url, 'http://127.0.0.1:' + port);
    const state = sessionFor(req, url);
    if (!state) return reply(res, {error: 'UNKNOWN_FIXTURE', scenarios: [...scenarios]}, 400);
    const cookie = `${cookieName}=${state.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionTtl / 1000}`;
    res.setHeader('Set-Cookie', cookie);
    res.setHeader('X-GSL-Local-Fixture', state.scenario);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await api(req, res, url, state);
    // Block callbacks and server actions too. Only page/resource GETs reach the local Next process.
    if (!['GET', 'HEAD'].includes(req.method) || url.pathname.startsWith('/auth/')) return reply(res, {error: 'FIXTURE_ROUTE_NOT_IMPLEMENTED'}, 404);
    const headers = {...req.headers, host: target.host};
    delete headers.authorization;
    delete headers.cookie;
    delete headers.origin;
    // Keep only the harmless locale cookie; never forward an actual Supabase session.
    const language = req.headers.cookie?.split(';').map(value => value.trim()).find(value => /^gsl-language=(en|fr|es|pt|de|it|tr|ar|hi|zh)$/.test(value));
    if (language) headers.cookie = language;
    const upstream = http.request({hostname: target.hostname, port: target.port || 80, path: req.url, method: req.method, headers}, response => {
      const responseHeaders = {...response.headers, 'set-cookie': cookie, 'cache-control': 'private, no-store', 'x-gsl-local-fixture': state.scenario};
      res.writeHead(response.statusCode || 502, responseHeaders);
      response.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) reply(res, {error: 'NEXT_UNAVAILABLE', message: 'Start Next at ' + target.origin}, 502);
      else res.destroy();
    });
    req.pipe(upstream);
  } catch (error) {
    if (!res.headersSent) reply(res, {error: error.message === 'INVALID' ? 'INVALID' : 'FIXTURE_ERROR'}, error.message === 'INVALID' ? 400 : 500);
    else res.destroy();
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Local fictional security fixtures: http://127.0.0.1:${port}/compte/securite?next=%2Fadministration&lang=fr&fixture=setup`);
  console.log('Synthetic verification code: 123456. No real accounts or authenticator factors are used.');
});
