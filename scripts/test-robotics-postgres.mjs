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
const snapshot=()=>scalar('select public.admin_catalogue_snapshot()');
const mutate=input=>scalar('select public.admin_catalogue_mutate($1::jsonb)',[JSON.stringify(input)]);
const imported=async(actor,sourceDigest=digest)=>{
 await db.exec('reset role;begin');
 try{
  await db.query("select set_config('gsl.import_payload',$1,true),set_config('gsl.import_digest',$2,true),set_config('gsl.import_actor',$3,true)",[JSON.stringify(data),sourceDigest,actor]);
  await db.exec(operation);await db.exec('commit');
 }catch(error){await db.exec('rollback');throw error;}
};
const companyCommand=c=>({action:'save_company',id:c.id,revision:1,name:c.name,country:c.country,city:c.city,description:c.description,processes:c.processes,materials:c.materials,website:c.website,research:c.details.research});
const productCommand=p=>({action:'save_product',id:p.id,revision:1,name:p.name,reference:p.reference,category:p.category,description:p.description,specifications:p.specifications});
let rejectedResearchCases=0;
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
 const before=await scalar('select to_jsonb(o) from public.organizations o where id=$1',[legacy]);
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
 const beforeCount=await scalar('select count(*)::int from public.published_products');
 assert.equal((await scalar("select public.search_robotics_catalogue('{}')")).count,0,'General capabilities are not admitted automatically');
 const payload=JSON.parse(await readFile('data/robotics-catalogue-2026-10-12.json','utf8'));
 const operation=await readFile('supabase/operations/import-robotics-catalogue.sql','utf8');
 const importRobotics=async(actor)=>{await db.exec('reset role;begin');try{await db.query("select set_config('gsl.robotics_payload',$1,true),set_config('gsl.import_actor',$2,true)",[JSON.stringify(payload),actor]);await db.exec(operation);await db.exec('commit');}catch(e){await db.exec('rollback');throw e;}};
 await assert.rejects(importRobotics(ordinary),/INITIATING_OWNER_REQUIRED/);
 await importRobotics(owner1);await importRobotics(owner1);
 assert.equal(await scalar('select count(*)::int from public.published_products'),beforeCount+1,'Idempotent import, historic records preserved');
 const product=payload.products[0].id;
 await as(null,'aal1','anon');
 await assert.rejects(db.query('select reviewed_by from public.robotics_admissions'),/permission denied/);
 const search=criteria=>scalar('select public.search_robotics_catalogue($1::jsonb)',[JSON.stringify(criteria)]);
 for(const q of ['robotique','robotics','robot','IML','R928'])assert.equal((await search({q})).count,1,'Robotics vocabulary: '+q);
 const result=await search({});assert.deepEqual(result.families,{'robots-plateformes':1});
 assert.equal(result.suppliers[0].matched_products[0].category,'robots-plateformes');
 assert.equal((await search({category:'textile'})).count,0);
 assert.equal((await search({metric:'payload_kg',minimum:'5'})).count,0,'Missing performance not treated as sufficient');
 assert.equal((await search({metric:'payload_kg',minimum:'5',unknown:'include'})).suppliers[0].match_group,'unknown');
 await assert.rejects(db.query('update public.robotics_admissions set production_country=$1 where product_id=$2',['FR',product]),/permission denied/);
 await db.exec('reset role');
 await db.query("update public.robotics_admissions set technical=$1 where product_id=$2",[JSON.stringify({payload_kg:'12',reach_mm:'800',interface:'EtherCAT'}),product]);
 await as(null,'aal1','anon');
 assert.equal((await search({category:'robots-plateformes',metric:'payload_kg',minimum:'10',maximum:'15',connection:'ethercat'})).count,1);
 assert.equal((await search({q:'12 kg'})).count,1,'Canonical units searchable');
 assert.equal(await scalar("select public.robotics_token('12,5 N·m')"),'12.5 nm');
 assert.equal((await search({metric:'payload_kg',minimum:'13'})).count,0);
 assert.equal((await search({metric:'payload_kg',maximum:'11'})).count,0);
 assert.equal((await search({connection:'CANopen'})).count,0);
 assert.equal((await search({metric:'payload_kg',minimum:'13',priority:'preferred'})).suppliers[0].match_group,'preferred_unmatched');
 const aliases=await scalar("select public.robotics_token('pince préhenseur grippers robotique servomoteur réducteur encodeur')");
 assert.equal(aliases,'gripper gripper gripper robot servo gearbox encoder');
 await db.exec('reset role');
 await db.query('update public.published_products set source_revision=source_revision+1 where product_id=$1',[product]);
 await as(null,'aal1','anon');assert.equal((await search({})).count,0,'A changed publication invalidates its old admission');
 await db.exec('reset role');
 await db.query('update public.published_products set source_revision=source_revision-1,withdrawn_at=now() where product_id=$1',[product]);
 await as(null,'aal1','anon');assert.equal((await search({})).count,0,'Withdrawn products stay hidden');
 console.log('Robotics admission, scoped search, synonyms, technical bounds, unknowns, permissions, idempotent import and stale-publication checks passed.');
}finally{await db.close();}
