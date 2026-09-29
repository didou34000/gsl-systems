process.on('uncaughtException',e=>{console.error(e.message,e.where||'');process.exit(1)});
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir,writeFile} from 'node:fs/promises';
// In-memory PostgreSQL only. This runner never accepts an external URL.
if(process.env.DATABASE_URL||process.env.SUPABASE_URL)throw Error('External database configuration refused for fixtures');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1')) $$;
select set_config('request.jwt.claim.aal','aal2',false);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema public,auth,storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to authenticated;`);
for(const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){
 await db.exec(await readFile('supabase/migrations/'+name,'utf8'));console.log('Applied locally:',name);
}
await db.exec(await readFile('supabase/tests/operational-isolation.sql','utf8'));
console.log('PostgreSQL integration assertions passed (PGlite; not hosted Auth/Storage verification).');
await (await import('./test-workflows.mjs')).testWorkflows(db);
await (await import('./test-security-extensions.mjs')).testSecurityExtensions(db);
await (await import('./test-request-files.mjs')).testRequestFiles(db);
await (await import('./test-republication.mjs')).testRepublication(db);
await (await import('./test-privacy.mjs')).testPrivacy(db);
const columns=(await db.query("select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' order by table_name,ordinal_position")).rows;
const tables=new Map();for(const c of columns){if(!tables.has(c.table_name))tables.set(c.table_name,[]);const type=c.data_type==='boolean'?'boolean':c.data_type==='jsonb'?'unknown':c.data_type==='ARRAY'?'string[]':['integer','smallint','bigint','numeric'].includes(c.data_type)?'number | string':'string';tables.get(c.table_name).push(`    ${c.column_name}: ${type}${c.is_nullable==='YES'?' | null':''};`)}
await writeFile('lib/supabase/database.generated.ts','// Generated from the locally migrated PostgreSQL schema by scripts/test-postgres.mjs.\n// Hosted schema parity is NOT confirmed.\nexport interface DatabaseRows {\n'+[...tables].map(([name,fields])=>`  ${name}: {\n${fields.join('\n')}\n  };`).join('\n')+'\n}\n');
await db.close();
