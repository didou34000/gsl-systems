import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {transpileModule, ModuleKind, ScriptTarget} from 'typescript';

// Execute the real route with controlled Auth/RPC adapters; never reach a hosted service.
const compile = source => transpileModule(source, {compilerOptions: {module: ModuleKind.ESNext, target: ScriptTarget.ES2022}}).outputText;
const validationSource = await readFile(new URL('../app/api/admin/validation.ts', import.meta.url), 'utf8');
const validationCode = compile(validationSource).replace("from 'zod'", `from '${import.meta.resolve('zod')}'`);
const validationUrl = `data:text/javascript;base64,${Buffer.from(validationCode).toString('base64')}`;
const {adminMutationSchema} = await import(validationUrl);
const source = await readFile(new URL('../app/api/admin/route.ts', import.meta.url), 'utf8');
const rewritten = source
  .replace("import {authClient} from '@/lib/supabase/server';", 'const authClient = () => globalThis.__adminTestClient;')
  .replace("import {allowedOrigin} from '@/lib/auth-policy';", "const allowedOrigin = request => request.headers.get('origin') === 'https://example.invalid';")
  .replace("import {adminMutationSchema} from './validation';", `import {adminMutationSchema} from '${validationUrl}';`);
const {GET, POST} = await import(`data:text/javascript;base64,${Buffer.from(compile(rewritten)).toString('base64')}`);
let rpcCalls = 0;
const setClient = ({user = {id: randomUUID()}, authError = null, error = null, data = {revision: 2}, throwError = false} = {}) => {
  globalThis.__adminTestClient = {
    auth: {getUser: async () => ({data: {user}, error: authError})},
    rpc: async () => {rpcCalls++; if (throwError) throw Error('Unavailable'); return {data, error};},
  };
};
const command = {action: 'task.create', revision: 0, id: randomUUID(), title: ' Task ', description: '', status: 'todo', priority: 'medium', dueDate: null};
const request = (body = command, origin = 'https://example.invalid', contentType = 'application/json') => new Request('https://example.invalid/api/admin', {method: 'POST', headers: {origin, 'content-type': contentType}, body: typeof body === 'string' ? body : JSON.stringify(body)});
setClient({user: null});
assert.equal((await GET()).status, 401);
assert.equal((await POST(request())).status, 401);
assert.equal(rpcCalls, 0);
setClient();
const forbidden = await POST(request(command, 'https://evil.invalid'));
assert.equal(forbidden.status, 403);
assert.equal((await forbidden.json()).error, 'ORIGIN');
assert.equal(rpcCalls, 0);
for (const body of ['{', 'x'.repeat(100001), {...command, owner_id: randomUUID()}, {...command, title: ' '}, {...command, dueDate: '2026-02-30'}, {...command, dueDate: '0000-01-01'}, {...command, revision: -1}, {...command, id: 'invalid'}]) assert.equal((await POST(request(body))).status, 400);
assert.equal((await POST(request(command, 'https://example.invalid', 'text/plain'))).status, 400);
assert.equal(rpcCalls, 0);
for (const [error, expected] of [['LOGIN_REQUIRED', 401], ['ADMIN_REQUIRED', 403], ['MFA_REQUIRED', 403], ['CONFLICT', 409], ['NOT_FOUND', 404], ['INVALID', 400], ['LIMIT_REACHED', 409], ['PERMISSION_REQUIRED',403], ['SELF_ACCESS_CHANGE',403], ['LAST_OWNER',409], ['USER_NOT_FOUND',404], ['EMAIL_UNCONFIRMED',409], ['ALREADY_GRANTED',409]]) {
  setClient({error: {message: error}});
  const response = await POST(request());
  assert.equal(response.status, expected);
  assert.deepEqual(await response.json(), {error, errorCode: error});
}
setClient({error:{message:'USER_INACTIVE'}});
assert.deepEqual(await (await POST(request())).json(),{error:'USER_INACTIVE',errorCode:'USER_INACTIVE'});
assert.equal((await POST(request())).status,409);
setClient({error: {message: 'Could not find function private information', code: 'PGRST202'}});
assert.equal((await (await GET()).json()).error, 'NOT_CONFIGURED');
setClient({error: {message: 'Database detail must not leak', code: 'XX000'}});
assert.deepEqual(await (await GET()).json(), {error: 'UNAVAILABLE', errorCode: 'UNAVAILABLE'});
setClient({throwError: true});
assert.equal((await GET()).status, 503);
setClient();
const response = await POST(request());
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
assert.equal(response.headers.get('vary'), 'Cookie');
assert.deepEqual(await response.json(), {revision: 2});
assert.equal(adminMutationSchema.parse(command).title, 'Task');
assert.equal(adminMutationSchema.safeParse({action: 'tasks.reorder', revision: 1, tasks: [{id: command.id, status: 'todo'}, {id: command.id.toUpperCase(), status: 'done'}]}).success, false);
assert.equal(adminMutationSchema.safeParse({action: 'preferences.update', revision: 1, widgetOrder: ['activity', 'activity', 'tasks', 'catalog']}).success, false);
const grant={action:'access.grant',email:' MEMBER@example.invalid ',role:'operator',reason:'Handle incoming enquiries',accessRevision:0};
assert.equal(adminMutationSchema.parse(grant).email,'member@example.invalid');
for(const invalid of [{...grant,role:'root'},{...grant,permissions:['access.manage']},{...grant,reason:'short'},{...grant,reason:'a'.repeat(501)},{...grant,accessRevision:-1},{...grant,email:'bad'}, {action:'access.change',userId:'bad',role:'admin',reason:grant.reason,accessRevision:0},{action:'access.revoke',userId:command.id,reason:grant.reason,accessRevision:0,role:'owner'}]) {
  assert.equal(adminMutationSchema.safeParse(invalid).success,false);
  assert.equal((await POST(request(invalid))).status,400);
}
assert.equal((await POST(request(grant))).status,200);
assert.equal((await POST(request({action:'access.change',userId:command.id,role:'analyst',reason:grant.reason,accessRevision:0}))).status,200);
assert.equal((await POST(request({action:'access.revoke',userId:command.id,reason:grant.reason,accessRevision:0}))).status,200);
delete globalThis.__adminTestClient;
console.log('Admin API checks passed: authentication, origin, JSON/size/schema validation, precise safe errors, no-store responses and duplicate detection.');
