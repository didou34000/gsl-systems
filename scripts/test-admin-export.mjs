import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';

// Real HTTP boundary + CSV serializer; only session and RPC transport are mocked.
const compile=source=>transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText;
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(compile(source)).toString('base64');
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const csv=moduleUrl(await read('lib/admin/csv.ts'));
const languages=moduleUrl(await read('lib/i18n/languages.ts'));
const translations=moduleUrl(await read('lib/admin/translations.ts'));
const accessTranslations=moduleUrl(await read('lib/admin/access-translations.ts'));
const serializer=moduleUrl((await read('lib/admin/export.ts')).replace("from './csv'",`from '${csv}'`).replace("from './translations'",`from '${translations}'`).replace("from './access-translations'",`from '${accessTranslations}'`));
const route=(await read('app/api/admin/export/route.ts'))
  .replace("from 'zod'",`from '${import.meta.resolve('zod')}'`)
  .replace("import {authClient} from '@/lib/supabase/server';",'const authClient=()=>globalThis.__exportClient;')
  .replace("import {allowedOrigin} from '@/lib/auth-policy';","const allowedOrigin=request=>request.headers.get('origin')==='https://example.invalid';")
  .replace("from '@/lib/admin/export'",`from '${serializer}'`)
  .replace("from '@/lib/i18n/languages'",`from '${languages}'`);
const {POST}=await import(moduleUrl(route));
let calls=[];
const base={resource:'contacts',rows:[{id:'synthetic',name:'=HYPERLINK("x")',email:'test@example.invalid',subject:'Échantillon',body:'Line one\n"Line two"',language:'fr',createdAt:'2026-10-07',resolvedAt:null,privatePayload:'SECRET-MUST-NOT-EXPORT'}],generatedAt:'2026-10-07',truncated:false,rowLimit:5000};
function client({user={id:'test'},error=null,data=base,authError=null}={}) {calls=[];globalThis.__exportClient={auth:{getUser:async()=>({data:{user},error:authError})},rpc:async(name,args)=>{calls.push({name,args});return {data,error};}};}
const request=(body={resource:'contacts',language:'fr'},origin='https://example.invalid',type='application/json')=>new Request('https://example.invalid/api/admin/export',{method:'POST',headers:{origin,'content-type':type},body:typeof body==='string'?body:JSON.stringify(body)});
client({user:null});assert.equal((await POST(request())).status,401);assert.equal(calls.length,0);
client();assert.equal((await POST(request(undefined,'https://evil.invalid'))).status,403);assert.equal(calls.length,0);
assert.equal((await POST(request(undefined,'https://example.invalid','text/plain'))).status,400);
for(const body of ['{','x'.repeat(2049),{resource:'users',language:'fr'},{resource:'contacts',language:'xx'},{resource:'contacts',language:'fr',fields:['privatePayload']},{resource:'contacts',language:'fr',role:'owner'}])assert.equal((await POST(request(body))).status,400);
assert.equal(calls.length,0);
for(const [code,status]of [['LOGIN_REQUIRED',401],['ADMIN_REQUIRED',403],['MFA_REQUIRED',403],['PERMISSION_REQUIRED',403],['INVALID',400]]){client({error:{message:code}});const r=await POST(request());assert.equal(r.status,status);assert.equal(await r.text(),JSON.stringify({error:code,errorCode:code}));}
client({error:{message:'SQL detail secret',code:'XX000'}});assert.equal(await (await POST(request())).text(),JSON.stringify({error:'UNAVAILABLE',errorCode:'UNAVAILABLE'}));
client({error:{message:'Missing RPC',code:'PGRST202'}});assert.equal((await POST(request())).status,503);
for(const data of [null,{...base,resource:'products'},{...base,rows:[null]},{...base,rows:[[]]},{...base,rows:Array(5001).fill({})}]){client({data});assert.equal((await POST(request())).status,503);}
for(const language of ['en','fr','es','pt','de','it','tr','ar','hi','zh']){
  client();const result=await POST(request({resource:'contacts',language}));assert.equal(result.status,200);
  assert.match(result.headers.get('content-disposition'),/^attachment; filename="gsl-admin-contacts-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('vary'),'Cookie');assert.equal(result.headers.get('x-content-type-options'),'nosniff');
  assert.equal(result.headers.get('x-export-row-count'),'1');const bytes=new Uint8Array(await result.arrayBuffer());assert.deepEqual([...bytes.slice(0,3)],[239,187,191]);
  const text=new TextDecoder().decode(bytes);assert.ok(text.includes("'=HYPERLINK"));assert.ok(text.includes('""Line two""'));assert.ok(!text.includes('SECRET-MUST-NOT-EXPORT'));assert.deepEqual(calls,[{name:'admin_export',args:{input:{resource:'contacts'}}}]);
}
client({data:{...base,truncated:true}});assert.equal((await POST(request())).headers.get('x-export-truncated'),'true');
delete globalThis.__exportClient;
console.log('Admin export HTTP passed: role/MFA errors, origin, bounded validated requests, safe fields, CSV formulas, 10 languages, attachments, no cache and truncation. No hosted services contacted.');
