import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// All users, messages and edits are synthetic, in memory. Never run against GSL.
if(process.env.DATABASE_URL||process.env.SUPABASE_URL)throw Error('External database configuration refused for fixtures');
const db=new PGlite();
const raw=await readFile('data/curated-catalogue-2026-10-09.json','utf8');
const data=JSON.parse(raw),digest=createHash('sha256').update(raw).digest('hex');
const operation=await readFile('supabase/operations/import-curated-catalogue.sql','utf8');
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const as=async(id,aal='aal2',role='authenticated')=>{
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id||'',aal]);
 await db.exec(`set role ${role}`);
};
const imported=async(actor,sourceDigest=digest)=>{
 await db.exec('reset role;begin');
 try{
  await db.query("select set_config('gsl.import_payload',$1,true),set_config('gsl.import_digest',$2,true),set_config('gsl.import_actor',$3,true)",[JSON.stringify(data),sourceDigest,actor]);
  await db.exec(operation);await db.exec('commit');
 }catch(error){await db.exec('rollback');throw error;}
};
try{
 await db.exec(`
 create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',banned_until timestamptz,deleted_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1'))$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 grant usage on schema public,auth,storage to anon,authenticated;
 grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;
 `);
 for(const name of (await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort()){
  try{await db.exec(await readFile('supabase/migrations/'+name,'utf8'));}catch(error){throw Error(`Migration ${name}: ${error.message}`);}
 }
 const [owner1,owner2,ordinary,admin]=Array.from({length:4},()=>randomUUID());
 for(const id of [owner1,owner2,ordinary,admin])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 for(const id of [owner1,owner2])await db.query("insert into private.platform_admins(user_id,role) values($1,'owner')",[id]);
 await db.query("insert into private.platform_admins(user_id,role) values($1,'admin')",[admin]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ordinary]);
 const legacy=randomUUID();
 await db.query("insert into public.organizations(id,created_by,legal_name,country_code,entity_kind,supplier) values($1,$2,'Existing control business','FR','company',true)",[legacy,ordinary]);
 await assert.rejects(imported(ordinary),/INITIATING_OWNER_REQUIRED/);
 const invalidCompanies=[];
 for(const c of data.companies)if(!await scalar('select private.curated_company_research_valid($1::jsonb,$2)',[JSON.stringify(c.details.research),c.source_id]))invalidCompanies.push(c.source_id);
 assert.deepEqual(invalidCompanies,[],'Every real company source payload passes the same database validator used by owner edits');
 const invalidProducts=[];
 for(const p of data.products)if(!await scalar('select private.curated_product_research_valid($1::jsonb,$2,$3)',[p.specifications.research_data,p.source_key,p.company_source_id]))invalidProducts.push(p.source_key);
 assert.deepEqual(invalidProducts,[],'Every real product source payload passes database validation');
 const leapDay={...data.companies[0].details.research,checkedAt:'2024-02-29'};
 assert.equal(await scalar('select private.curated_company_research_valid($1::jsonb,$2)',[JSON.stringify(leapDay),data.companies[0].source_id]),true,'A real leap day remains valid');
 await imported(owner1);
 const fixtureBuyer=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[fixtureBuyer,'buyer@example.invalid']);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[fixtureBuyer]);
 const buyerOrg=(await db.query("insert into public.organizations(created_by,legal_name,country_code,entity_kind,buyer) values($1,'Acheteur fictif local','FR','company',true) returning id",[fixtureBuyer])).rows[0].id;
 await as(owner1,'aal2');const payload=JSON.parse(await readFile('data/gsl-70-import-2026-10-13.json','utf8'));await scalar('select public.import_component_candidates($1::jsonb)',[JSON.stringify(payload)]);
 const candidate=payload.rows.find(r=>r.name==='YMTM Teknoloji');
 await scalar('select public.sourcing_command($1,$2::jsonb,$3)',['qualify',JSON.stringify({id:candidate.id,revision:1,family:'actionnement-transmission',level:'explicit',productionChecked:true,delivery:'on_review',deliveryEvidence:'',publicEnabled:true,reviewNote:'Démonstration locale basée sur les données du tableau ; aucune publication réelle.'}),randomUUID()]);
 let currentIdentity='buyer';
 const http=await import('node:http');
 function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 async function body(req){let raw='';for await(const c of req){raw+=c;if(raw.length>2000000)throw Error('SIZE')}return raw?JSON.parse(raw):{};}
 async function publicRows(url){const table=url.pathname.split('/').at(-1);if(!['component_products','component_supplier_profiles','published_products','published_supplier_profiles'].includes(table))return [];const clauses=['withdrawn_at is null'];const params=[];for(const key of ['product_id','organization_id','category']){const value=url.searchParams.get(key);if(value?.startsWith('eq.')){params.push(value.slice(3));clauses.push(key+'=$'+params.length);}else if(value?.startsWith('in.(')){params.push(value.slice(4,-1).split(','));clauses.push(key+'::text=any($'+params.length+'::text[])');}}await as(null,'aal1','anon');const result=await db.query('select * from public.'+table+' where '+clauses.join(' and ')+' limit 100',params);return result.rows;}
 http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:5192');if(req.method==='POST'&&url.pathname==='/rest/v1/rpc/search_components_catalogue'){const b=await body(req);await as(null,'aal1','anon');return json(res,await scalar('select public.search_components_catalogue($1::jsonb)',[JSON.stringify(b.criteria||{})]));}if(req.method==='GET'&&url.pathname.startsWith('/rest/v1/')){const rows=await publicRows(url);return json(res,req.headers.accept?.includes('object+json')?(rows[0]||null):rows);}return json(res,{error:'FIXTURE_ONLY'},404);}catch(e){console.log('Public fixture error',e.message);return json(res,{error:'FIXTURE_ERROR'},500)}}).listen(5192,'127.0.0.1');
 http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:5191');if(url.searchParams.has('fixture'))currentIdentity=url.searchParams.get('fixture')==='admin'?'admin':url.searchParams.get('fixture')==='guest'?'guest':'buyer';
 if(url.pathname.startsWith('/api/')){
  if(url.pathname==='/api/company-images')return json(res,{error:'NOT_FOUND'},404);
  if(currentIdentity==='guest'&&['/api/sourcing','/api/workspace'].includes(url.pathname))return json(res,{error:'LOGIN_REQUIRED'},401);
  if(url.pathname==='/api/workspace')return json(res,{user:{name:'Compte fictif',email:'buyer@example.invalid'},favorites:[],drafts:[]});
  if(url.pathname==='/api/messaging')return json(res,{unread:0});
  if(url.pathname==='/api/request-files')return json(res,{files:[],scanningAvailable:false});
  if(url.pathname==='/api/home-catalogue'){await as(null,'aal1','anon');const catalogue=await scalar("select public.search_components_catalogue('{}')");const products=catalogue.suppliers.flatMap(s=>s.matched_products.map(p=>({...p,manufacturer:s})));return json(res,{products,suppliers:catalogue.suppliers,families:catalogue.families});}
  if(url.pathname==='/api/admin')return json(res,{viewer:{email:'admin@example.invalid',role:'owner',permissions:['overview.read','catalog.read','contacts.read','contacts.manage','tasks.manage','activity.read','data.export','access.manage'],reviewer:false},stats:{}});
  if(url.pathname==='/api/platform'&&url.searchParams.get('view')==='workspace')return json(res,{currentUser:{id:fixtureBuyer,email:'buyer@example.invalid'},organizations:[{id:buyerOrg,legal_name:'Acheteur fictif local',buyer:true}],members:[{organization_id:buyerOrg,user_id:fixtureBuyer,role:'owner',active:true}]});
  if(url.pathname==='/api/platform'&&url.searchParams.get('view')==='catalogue'){await as(null,'aal1','anon');return json(res,await scalar('select public.search_components_catalogue($1::jsonb)',[JSON.stringify(Object.fromEntries(url.searchParams))]));}
  if(url.pathname==='/api/platform'&&url.searchParams.get('view')==='selection'){await as(null,'aal1','anon');const products=(await db.query('select * from public.component_products where product_id::text=any($1::text[])',[(url.searchParams.get('ids')||'').split(',')])).rows;return json(res,{products});}
  if(url.pathname==='/api/sourcing'){await as(currentIdentity==='admin'?owner1:fixtureBuyer,currentIdentity==='admin'?'aal2':'aal1');if(req.method==='POST'){const b=await body(req);const result=await scalar('select public.sourcing_command($1,$2::jsonb,$3)',[b.action,JSON.stringify(b.args),b.command]);return json(res,{ok:true,result});}return json(res,await scalar('select public.sourcing_snapshot($1,$2)',[url.searchParams.get('view')==='admin',url.searchParams.get('id')||null]));}
  return json(res,{error:'FIXTURE_ONLY'},404);
 }
 url.searchParams.delete('fixture');if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/auth/'))return json(res,{error:'FIXTURE_WRITE_BLOCKED'},405);
 const headers={...req.headers,host:'127.0.0.1:5173'};delete headers.authorization;delete headers.cookie;delete headers.origin;const locale=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>/^gsl-language=(en|fr)$/.test(x));if(locale)headers.cookie=locale;
 const upstream=http.request({hostname:'127.0.0.1',port:5173,path:url.pathname+url.search,method:req.method,headers},r=>{const h={...r.headers,'cache-control':'no-store'};delete h['set-cookie'];res.writeHead(r.statusCode,h);r.pipe(res);});upstream.on('error',()=>json(res,{error:'START_NEXT_ON_5173'},502));req.pipe(upstream);
 }catch(e){const known=['FORBIDDEN','CONFLICT','FILES_PENDING','INCOMPLETE','INVALID','EXPIRED','MFA_REQUIRED','PERMISSION_REQUIRED'].find(c=>e.message.includes(c));console.log('Fixture request:',known||e.message);return json(res,{error:known||'FIXTURE_ERROR'},known==='CONFLICT'?409:known?422:500)}}).listen(5191,'127.0.0.1',()=>console.log('Sourcing fixture on http://127.0.0.1:5191 — real RPCs in isolated memory; fixture=buyer/admin/guest, no external writes.'));
 // A running HTTP fixture intentionally owns the isolated DB until the process exits.
}catch(e){await db.close();throw e;}
