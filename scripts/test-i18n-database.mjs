import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';

// This test uses only an isolated in-memory database and mocked Auth transport.
if(process.env.DATABASE_URL||process.env.SUPABASE_URL)throw Error('External database configuration refused for fixtures');
const db=new PGlite();
const locales=['en','fr','es','pt','de','it','tr','ar','hi','zh'];
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1'))$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
grant usage on schema public,auth,storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;`);
try{
 for(const name of (await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
 const owners=[{id:randomUUID(),language:'fr'},{id:randomUUID(),language:'en'}];
 for(const owner of owners){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[owner.id,owner.id+'@example.invalid']);
  await db.query("insert into private.platform_admins(user_id,role) values($1,'owner')",[owner.id]);
  await db.query("insert into public.profiles(user_id,display_name,language) values($1,'Synthetic owner',$2) on conflict(user_id) do update set language=excluded.language",[owner.id,owner.language]);
 }
 const user=randomUUID();
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'locale-test@example.invalid',now())",[user]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.exec('set role authenticated');
 for(const language of locales){
  await db.query("insert into public.profiles(user_id,display_name,language) values($1,'Locale tester',$2) on conflict(user_id) do update set language=excluded.language",[user,language]);
  assert.equal((await db.query('select language from public.profiles where user_id=$1',[user])).rows[0].language,language);
 }
 await assert.rejects(db.query("update public.profiles set language='xx' where user_id=$1",[user]),/profiles_language_check/);
 await db.exec('reset role;set role anon');
 const contacts=[];
 for(const language of locales){
  const id=randomUUID();contacts.push([id,language]);
  const args=[id,language+'@example.invalid','Locale tester','A language-specific enquiry','A synthetic contact message for language persistence.',language];
  assert.equal((await db.query('select public.submit_contact($1,$2,$3,$4,$5,$6) id',args)).rows[0].id,id);
  assert.equal((await db.query('select public.submit_contact($1,$2,$3,$4,$5,$6) id',args)).rows[0].id,id,'Same request is idempotent');
 }
 await assert.rejects(db.query('select public.submit_contact($1,$2,$3,$4,$5,$6)',[randomUUID(),'bad@example.invalid','Locale tester','Invalid language','This synthetic request must be rejected.','xx']),/INVALID/);
 await db.exec('reset role');
 for(const [id,language] of contacts){
  assert.equal((await db.query('select language from public.contact_requests where id=$1',[id])).rows[0].language,language,'Contact retains the selected interface language');
  const notifications=(await db.query('select recipient_id,language,template from public.notification_outbox where resource_id=$1 order by template',[id])).rows;
  assert.equal(notifications.find(row=>row.template==='contact_received').language,language==='fr'?'fr':'en','Acknowledgement uses an existing mail template');
  for(const owner of owners)assert.equal(notifications.find(row=>row.template==='contact_operator'&&row.recipient_id===owner.id).language,owner.language,'Owner notifications follow each recipient’s language');
  assert.equal(notifications.length,3,'One acknowledgement and two owner notifications remain idempotent');
 }
 await assert.rejects(db.query("update public.contact_requests set language='xx' where id=$1",[contacts[0][0]]),/contact_requests_language_check/);
}finally{await db.close();}

// Exercise the actual route code with Auth replaced at the transport boundary.
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compile=async path=>ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const languagesUrl=dataUrl(await compile('lib/i18n/languages.ts'));
const policyUrl=dataUrl(await compile('lib/auth-policy.ts'));
const authUrl=dataUrl('export const authClient=async()=>globalThis.__gslLocaleAuthFixture;');
let calls=[];
globalThis.__gslLocaleAuthFixture={auth:{
 signUp:async args=>{calls.push(['signup',args]);return {error:null}},
 resetPasswordForEmail:async(...args)=>{calls.push(['reset',...args]);return {error:null}},
 getUser:async()=>({data:{user:{id:'fixture',email_confirmed_at:'2026-10-06'}}}),
 exchangeCodeForSession:async()=>({error:null}),
},from:()=>({
 select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'fixture'},error:null})})}),
 update:profile=>({eq:async()=>{calls.push(['profile',profile]);return {error:null}}}),
})};
const authSource=(await compile('app/api/auth/route.ts')).replace("'@/lib/supabase/server'",JSON.stringify(authUrl)).replace("'@/lib/auth-policy'",JSON.stringify(policyUrl)).replace("'@/lib/i18n/languages'",JSON.stringify(languagesUrl));
const route=await import(dataUrl(authSource));
for(const language of locales){
 for(const action of ['signup','reset','profile']){
  const request=new Request('https://www.gsl-systems.com/api/auth',{method:'POST',headers:{origin:'https://www.gsl-systems.com','Content-Type':'application/json'},body:JSON.stringify({action,language,email:'locales@example.invalid',name:'Locale tester',password:'synthetic-safe-passphrase',next:'/compte'})});
  const result=await route.POST(request);assert.equal(result.status,200,language+' '+action);
  const call=calls.at(-1);
  if(action==='signup'){assert.equal(call[1].options.data.language,language);assert.equal(new URL(call[1].options.emailRedirectTo).searchParams.get('lang'),language);}
  if(action==='reset')assert.equal(new URL(call[2].redirectTo).searchParams.get('lang'),language);
  if(action==='profile')assert.equal(call[1].language,language);
 }
}
const nextUrl=dataUrl(`export const NextResponse={redirect:url=>{const response=new Response(null,{status:307,headers:{location:url.toString()}});response.cookies={set:(name,value)=>response.headers.append('Set-Cookie',name+'='+value)};return response}};`);
const callbackSource=(await compile('app/auth/callback/route.ts')).replace("'next/server'",JSON.stringify(nextUrl)).replace("'@/lib/supabase/server'",JSON.stringify(authUrl)).replace("'@/lib/auth-policy'",JSON.stringify(policyUrl)).replace("'@/lib/i18n/languages'",JSON.stringify(languagesUrl));
const callback=await import(dataUrl(callbackSource));
for(const language of locales){const response=await callback.GET(new Request('https://www.gsl-systems.com/auth/callback?code=fixture&next=%2Fcompte&lang='+language));assert.equal(response.headers.get('Set-Cookie'),'gsl-language='+language);assert.equal(response.headers.get('Location'),'https://www.gsl-systems.com/compte');}
assert.equal((await callback.GET(new Request('https://www.gsl-systems.com/auth/callback?code=fixture&lang=xx'))).headers.get('Set-Cookie'),null);
delete globalThis.__gslLocaleAuthFixture;
const {pathToFileURL}=await import('node:url');
const catalogueUrl=dataUrl('export const publicCatalogue=()=>({rpc:async(name,args)=>{globalThis.__gslLocaleContactFixture=args;return {data:args.request_id,error:null}}});');
const contactSource=(await compile('app/api/contact/route.ts')).replace("'zod'",JSON.stringify(pathToFileURL(process.cwd()+'/node_modules/zod/index.js').href)).replace("'@/lib/supabase/public-catalogue'",JSON.stringify(catalogueUrl)).replace("'@/lib/auth-policy'",JSON.stringify(policyUrl)).replace("'@/lib/i18n/languages'",JSON.stringify(languagesUrl));
const contactRoute=await import(dataUrl(contactSource));
for(const language of [...locales,'xx']){
 const request=new Request('https://www.gsl-systems.com/api/contact',{method:'POST',headers:{origin:'https://www.gsl-systems.com','Content-Type':'application/json'},body:JSON.stringify({request_id:randomUUID(),email:'contact@example.invalid',name:'Locale tester',subject:'Locale enquiry',body:'A synthetic message that is never delivered.',language})});
 const response=await contactRoute.POST(request);
 assert.equal(response.status,language==='xx'?422:200);
 if(language!=='xx')assert.equal(globalThis.__gslLocaleContactFixture.language,language);
}
delete globalThis.__gslLocaleContactFixture;
console.log('Ten-language database persistence, contact idempotency/API payloads, email fallback, invalid-locale rejection, Auth payloads and callback cookies passed. No hosted services contacted.');
