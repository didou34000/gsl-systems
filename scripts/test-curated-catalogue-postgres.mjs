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
 assert.deepEqual(await scalar('select to_jsonb(o) from public.organizations o where id=$1',[legacy]),before,'Existing records stay byte-for-byte unchanged');
 assert.equal(await scalar('select count(*)::int from private.curated_catalogue_companies'),50);
 assert.equal(await scalar('select count(*)::int from private.curated_catalogue_products'),78);
 assert.equal(await scalar('select count(*)::int from private.curated_catalogue_owner_memberships'),100);
 assert.equal(await scalar("select count(*)::int from public.memberships m join private.curated_catalogue_companies c using(organization_id) where m.role='owner'"),0,'Import never asserts manufacturer ownership');
 assert.equal(await scalar('select count(*)::int from public.notification_outbox'),0,'Import creates no unsolicited mail');
 assert.equal(await scalar("select count(*)::int from public.products where made_to_order is null"),data.products.filter(p=>p.made_to_order===null).length);
 await imported(owner1);
 assert.equal(await scalar('select count(*)::int from public.organizations'),51,'Exact batch replay is idempotent');
 await assert.rejects(imported(owner1,'0'.repeat(64)),/BATCH_REQUIRES_REVIEW/);
 await as(null,'aal1','anon');
 await assert.rejects(snapshot(),/permission denied/);
 assert.equal(await scalar('select count(*)::int from public.published_supplier_profiles'),50);
 assert.equal(await scalar('select count(*)::int from public.published_products'),78);
 for(const category of new Set(data.products.map(p=>p.category))){
  const result=await scalar('select public.search_catalogue($1::jsonb)',[JSON.stringify({category})]);
  assert.ok(result.count>0,'Precise category '+category+' returns real products');
  assert.ok(result.suppliers.every(s=>s.public_details.research.kind==='gsl_research'&&s.matched_products.every(p=>p.description&&p.organization_id)), 'Cards receive provenance and description');
 }
 for(const category of ['metal','electricite','machines','plasturgie','construction'])assert.ok((await scalar('select public.search_catalogue($1::jsonb)',[JSON.stringify({category})])).count>0,'Broad category '+category+' remains useful');
 for(const id of [ordinary,admin]){await as(id);await assert.rejects(snapshot(),/ADMIN_REQUIRED|PERMISSION_REQUIRED/);await assert.rejects(mutate(companyCommand(data.companies[0])),/ADMIN_REQUIRED|PERMISSION_REQUIRED/);}
 await as(owner1,'aal1');await assert.rejects(snapshot(),/MFA_REQUIRED/);await assert.rejects(mutate(companyCommand(data.companies[0])),/MFA_REQUIRED/);
 await as(owner1);
 for(const table of ['curated_catalogue_companies','curated_catalogue_products','curated_catalogue_imports','curated_catalogue_events'])await assert.rejects(db.query('select * from private.'+table),/permission denied/);
 let state=await snapshot();assert.equal(state.companies.length,50);assert.equal(state.products.length,78);assert.equal(state.recipients.length,2);
 for(const c of data.companies)assert.equal((await mutate(companyCommand(c))).revision,2,'Owner can roundtrip company '+c.source_id);
 await as(owner2);
 for(const p of data.products)assert.equal((await mutate(productCommand(p))).revision,2,'Second owner can roundtrip product '+p.source_key);
 const c=data.companies[0],products=data.products.filter(p=>p.companyId===c.id),p=products[0];
 await assert.rejects(mutate(companyCommand(c)),/CONFLICT/);
 const invalid={...companyCommand(c),revision:2,name:'Visible contact contact@example.invalid'};
 await assert.rejects(mutate(invalid),/INVALID/);
 for(const description of ['Contact atelier : 01 23 45 67 89','Téléphone : 05 22 34 56 78','Phone : 01 23 45 67 89','standard : 00212 522 34 56 78'])await assert.rejects(mutate({...companyCommand(c),revision:2,description}),/INVALID/);
 await assert.rejects(mutate({...companyCommand(c),revision:2,website:'javascript:alert(1)'}),/INVALID/);
 await assert.rejects(mutate({...companyCommand(c),revision:2,country:'XX'}),/INVALID/);
 await assert.rejects(mutate({...companyCommand(c),revision:2,research:{...c.details.research,sourceId:'F999'}}),/INVALID/);
 const faultyProduct=structuredClone(productCommand(p)),pr=JSON.parse(faultyProduct.specifications.research_data);
 pr.commercial.price_min=1;pr.commercial.currency=null;faultyProduct.revision=2;faultyProduct.specifications.research_data=JSON.stringify(pr);
 await assert.rejects(mutate(faultyProduct),/INVALID/);
 // Owners may call the RPC directly: malformed public JSON must be rejected
 // here even when it never passes through the HTTP/Zod validation layer.
 const ruleTemplate={id:'fixture-rule',type:'Fixture',title:'Documented requirement',scope:'Fixture scope',requirements:'Fixture requirement',limits:'Fixture limit',sources:structuredClone(c.details.research.sources.slice(0,1))};
 const invalidCompanyResearch=[
  ['string schema version',r=>{r.schemaVersion='1';}],
  ['impossible calendar date',r=>{r.checkedAt='2026-02-31';}],
  ['invalid leap day',r=>{r.checkedAt='2025-02-29';}],
  ['object category',r=>{r.categories=[{value:'metal'}];}],
  ['null regulation',r=>{r.regulations=[null];}],
  ['object regulation title',r=>{r.regulations=[{...ruleTemplate,title:{text:'Broken rendering'}}];}],
  ['object regulation source title',r=>{const rule=structuredClone(ruleTemplate);rule.sources[0].title={text:'Broken rendering'};r.regulations=[rule];}],
  ['object agreement benefit',r=>{r.agreement.benefit={text:'Broken rendering'};}],
  ['scalar agreement source list',r=>{r.agreement.sources='not an array';}],
  ['empty primary source list',r=>{r.sources=[];}],
  ['object primary source title',r=>{r.sources[0].title={text:'Broken rendering'};}],
  ['object primary source support',r=>{r.sources[0].supports={text:'Broken rendering'};}],
  ['non-string primary source URL',r=>{r.sources[0].url=['https://example.invalid'];}],
 ];
 for(const [label,change] of invalidCompanyResearch){
  const input=structuredClone(companyCommand(c));input.revision=2;change(input.research);
  await assert.rejects(mutate(input),/INVALID/,'Direct company RPC rejects '+label);rejectedResearchCases++;
 }
 const priced=data.products.find(value=>value.source_key==='mikroe-current-4-click-mikroe-4755');
 assert.ok(priced,'The actual MIKROE tiers are present in the reviewed dataset');
 const publishedCommercial=JSON.parse(priced.specifications.research_data).commercial;
 const invalidProductResearch=[
  ['string schema version',r=>{r.schemaVersion='1';}],
  ['impossible calendar date',r=>{r.checkedAt='2026-02-31';}],
  ['invalid calendar month',r=>{r.checkedAt='2026-13-09';}],
  ['object application',r=>{r.applications=[{value:'automobile'}];}],
  ['null application',r=>{r.applications=[null];}],
  ['object material',r=>{r.materials=[{value:'steel'}];}],
  ['object specification',r=>{r.specifications={Diameter:{value:10}};}],
  ['reserved specification key',r=>{r.specifications={constructor:'Reserved'};}],
  ['object customization',r=>{r.customization={value:'custom'};}],
  ['object scope note',r=>{r.scopeNote={value:'scope'};}],
  ['object source title',r=>{r.sources[0].title={value:'source'};}],
  ['object commercial terms',r=>{r.commercial.terms={value:'terms'};}],
  ['object commercial status',r=>{r.commercial.status={value:'status'};}],
  ['object availability',r=>{r.commercial.availability={value:'available'};}],
  ['string order quantity',r=>{r.commercial.moq='1';r.commercial.unit='pièce';}],
 ];
 const invalidTiers=[
  ['negative tier price',v=>{v.price_tiers[0].price=-999;}],
  ['zero tier quantity',v=>{v.price_tiers[0].quantity=0;}],
  ['string tier quantity',v=>{v.price_tiers[0].quantity='1';}],
  ['duplicate tier quantity',v=>{v.price_tiers[1].quantity=v.price_tiers[0].quantity;}],
  ['unordered tier quantities',v=>{v.price_tiers.reverse();}],
  ['incoherent minimum price',v=>{v.price_min=1;}],
  ['incoherent maximum price',v=>{v.price_max=99;}],
  ['wrong minimum-price quantity',v=>{v.minimum_price_quantity=1;}],
  ['missing minimum-price quantity',v=>{delete v.minimum_price_quantity;}],
  ['negative minimum-price quantity',v=>{v.minimum_price_quantity=-10;}],
  ['tiers without price range',v=>{v.price_min=null;v.price_max=null;}],
  ['tiers without unit',v=>{v.unit=null;}],
  ['non-array tiers',v=>{v.price_tiers={quantity:1,price:18};}],
  ['null tier',v=>{v.price_tiers=[null];}],
 ];
 for(const [label,change] of invalidTiers)invalidProductResearch.push([label,r=>{r.commercial=structuredClone(publishedCommercial);change(r.commercial);}]);
 for(const [label,change] of invalidProductResearch){
  const input=structuredClone(productCommand(p));input.revision=2;
  const research=JSON.parse(input.specifications.research_data);change(research);input.specifications.research_data=JSON.stringify(research);
  await assert.rejects(mutate(input),/INVALID/,'Direct product RPC rejects '+label);rejectedResearchCases++;
 }
 await mutate({action:'set_product_visibility',id:p.id,revision:2,published:false});
 await mutate({action:'set_company_visibility',id:c.id,revision:2,published:false});
 await as(null,'aal1','anon');
 assert.equal(await scalar('select count(*)::int from public.published_supplier_profiles where organization_id=$1',[c.id]),0);
 assert.equal(await scalar('select count(*)::int from public.published_products where organization_id=$1',[c.id]),0);
 await as(owner1);
 await mutate({action:'set_company_visibility',id:c.id,revision:3,published:true});
 await as(null,'aal1','anon');
 assert.equal(await scalar('select count(*)::int from public.published_products where organization_id=$1',[c.id]),products.length-1,'Unhiding company preserves individually hidden product');
 await as(owner2);await mutate({action:'set_product_visibility',id:p.id,revision:3,published:true});
 const editedName=c.name+' — fixture edit';
 await mutate({...companyCommand(c),revision:4,name:editedName});
 await imported(owner1);
 await as(owner1);state=await snapshot();assert.equal(state.companies.find(x=>x.id===c.id).name,editedName,'Replaying import preserves owner edits');
 assert.equal(state.companies.find(x=>x.id===c.id).revision,5);
 await db.exec('reset role');
 assert.equal(await scalar('select count(*)::int from public.published_products where withdrawn_at is null'),78);
 assert.equal(await scalar("select count(*)::int from public.published_supplier_profiles where not private.curated_public_payload_is_safe(public_details)"),0);
 assert.equal(await scalar("select count(*)::int from public.published_products where not private.curated_public_payload_is_safe(specifications)"),0);
 assert.equal(await scalar('select count(*)::int from private.curated_catalogue_events'),133);
 console.log(`Curated catalogue PostgreSQL passed: actual 50-company/78-product dataset, source/contact guards including English phone, ${rejectedResearchCases} malformed nested/date/tier payloads rejected through the owner RPC, all 128 edit roundtrips, two owners/AAL2, preserved existing data, import idempotency, conflict rollback, 16 precise + 5 broad filters, independent visibility, unknown commercial data and audit.`);
}catch(error){console.error(error.message,error.where||'',error.position||'');process.exitCode=1;}finally{await db.close();}
