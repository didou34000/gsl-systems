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
 const outside=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[outside,'outsider@example.invalid']);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ordinary]);
 const buyer=(await db.query("insert into public.organizations(created_by,legal_name,country_code,entity_kind,buyer) values($1,'Acheteur test','FR','company',true) returning id",[ordinary])).rows[0].id;
 const call=(action,args,command=randomUUID())=>scalar('select public.sourcing_command($1,$2::jsonb,$3)',[action,JSON.stringify(args),command]);
 const view=(adminView=false,id=null)=>scalar('select public.sourcing_snapshot($1,$2)',[adminView,id]);
 const input={organization:buyer,title:'Actionneurs pour robot',details:'Deux actionneurs à qualifier pour notre robot mobile industriel.',items:[{description:'Actionneur A',quantity:'2',unit:'pcs'},{description:'Carte de commande B',quantity:'1',unit:'pcs'}],contact:{name:'Acheteur fictif',company:'Acheteur test',email:'buyer@example.invalid',phone:''},delivery:{country:'FR',postalCode:'34000',city:'Montpellier',address:'Adresse fictive',deadline:null,transport:true,customs:true,notes:''}};
 await as(ordinary,'aal1');
 const missingCountry=structuredClone(input);delete missingCountry.delivery.country;await assert.rejects(call('create',missingCountry),/INVALID/);
 await assert.rejects(call('create',{...input,contact:{...input.contact,role:'owner'}}),/INVALID/);
 const command=randomUUID(),created=await call('create',input,command);
 assert.match(created.reference,/^GSL-\d{6}-[A-F0-9]{12}$/);assert.deepEqual(await call('create',input,command),created);
 await assert.rejects(call('create',{...input,title:'Changed'},command),/CONFLICT/);
 assert.equal((await view(false,created.id)).cases[0].stage,'draft');
 await as(owner1,'aal2');assert.equal((await view(true)).cases.length,0,'Draft not disclosed to administrators');
 await assert.rejects(call('stage',{id:created.id,revision:1,stage:'qualification',note:'Tentative de lecture prématurée'}),/FORBIDDEN/);
 await as(outside,'aal1');await assert.rejects(view(false,created.id),/FORBIDDEN/);assert.equal((await scalar('select count(*)::int from public.delivery_cases')),0);
 await assert.rejects(call('submit',{id:created.id,revision:1}),/FORBIDDEN/);
 await as(ordinary,'aal1');const submitted=await call('submit',{id:created.id,revision:1});assert.equal(submitted.stage,'received');
 await assert.rejects(call('submit',{id:created.id,revision:1}),/CONFLICT/);
 await assert.rejects(scalar("select public.workflow('cancel_rfq',$1::jsonb,$2)",[JSON.stringify({id:created.rfqId,revision:4}),randomUUID()]),/FORBIDDEN/);
 await as(owner1,'aal1');await assert.rejects(view(true),/MFA_REQUIRED/);
 await as(admin,'aal2');let c=(await view(true,created.id)).cases[0];
 await assert.rejects(call('stage',{id:c.id,revision:c.revision,stage:'production',note:'Production sans devis accepté'}),/CONFLICT/);
 await call('stage',{id:c.id,revision:c.revision,stage:'qualification',note:'Examen des composants et du lieu de fabrication'});c=(await view(true,c.id)).cases[0];
 await call('stage',{id:c.id,revision:c.revision,stage:'quote_preparation',note:'Consultation manuelle pour produit et transport'});
 let snap=await view(true,c.id);c=snap.cases[0];
 const fileCall=(action,args)=>scalar('select public.manage_delivery_file($1,$2::jsonb)',[action,JSON.stringify(args)]);
 const commercial=await fileCall('reserve',{caseId:c.id,name:'Quote-test.pdf',mime:'application/pdf',size:10});
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('gsl-private',$1,'{}')",[commercial.path]);
 await fileCall('finalize',{caseId:c.id,id:commercial.id});
 await as(ordinary,'aal1');assert.equal(await scalar('select private.can_read_file($1)',[commercial.id]),false,'Buyer cannot read pending commercial bytes');assert.equal(await scalar('select count(*)::int from storage.objects where name=$1',[commercial.path]),0);
 await as(outside,'aal1');await assert.rejects(fileCall('reserve',{caseId:c.id,name:'bad.pdf',mime:'application/pdf',size:10}),/ADMIN_REQUIRED|PERMISSION_REQUIRED/);
 await db.exec('reset role');await db.query("update public.files set scan_status='clean' where id=$1",[commercial.id]);
 await as(ordinary,'aal1');assert.equal(await scalar('select count(*)::int from storage.objects where name=$1',[commercial.path]),1,'Buyer can read scanned commercial document');
 await as(admin,'aal2');assert.equal(await scalar('select count(*)::int from storage.objects where name=$1',[commercial.path]),1,'Authorized admin can read scanned document');
 await fileCall('delete',{caseId:c.id,id:commercial.id});await db.query('delete from storage.objects where name=$1',[commercial.path]);await fileCall('removed',{caseId:c.id,id:commercial.id});
 const cost=(amount,status='confirmed',note='')=>({status,amountMinor:amount,note});
 const p={currency:'EUR',products:snap.items.map(i=>({itemId:i.id,amountMinor:'20000',status:'confirmed',note:''})),costs:{transport:cost('5000'),insurance:cost('1000'),coordination:cost('2000'),duties:cost(null,'pending','Classement et origine à confirmer'),taxes:cost(null,'excluded','TVA à la charge de l’importateur')},validUntil:'2030-12-31',leadTime:'À confirmer après validation de série',paymentTerms:'Modalités à convenir, aucun paiement en ligne',exclusions:'TVA exclue, droits à confirmer',note:'Offre fictive isolée',commissionMinor:'500'};
 await call('proposal',{id:c.id,revision:c.revision,proposal:p});snap=await view(true,c.id);c=snap.cases[0];assert.equal(snap.proposals[0].firm_minor,null);assert.equal(snap.proposals[0].known_minor,48000);const oldProposal=snap.proposals[0].id;
 p.costs.duties=cost('300');p.costs.taxes=cost('9660');p.exclusions='';p.customsEvidence=snap.items.map(i=>({itemId:i.id,originCountry:'TR',productCode:'8501',sourceUrl:'https://example.invalid/official-test',checkedAt:'2026-10-13',note:'Origine et classement fictifs documentés dans le harness seulement'}));
 const missingEvidence={...p,customsEvidence:[]};await assert.rejects(call('proposal',{id:c.id,revision:c.revision,proposal:missingEvidence}),/INCOMPLETE/);
 await call('proposal',{id:c.id,revision:c.revision,proposal:p});snap=await view(true,c.id);c=snap.cases[0];assert.equal(snap.proposals[0].version,2);assert.equal(snap.proposals[0].firm_minor,57960);
 await as(ordinary,'aal1');const buyerView=await view(false,c.id);assert.equal(buyerView.proposals[0].commissionMinor,undefined,'Internal commissions never disclosed');
 await assert.rejects(call('accept',{id:c.id,revision:c.revision,proposalId:oldProposal,acknowledged:true}),/CONFLICT/);
 await assert.rejects(call('accept',{id:c.id,revision:c.revision,proposalId:snap.proposals[0].id,acknowledged:false}),/CONFLICT/);
 await call('accept',{id:c.id,revision:c.revision,proposalId:snap.proposals[0].id,acknowledged:true});assert.equal((await view(false,c.id)).payment.configured,false);
 await as(admin,'aal2');c=(await view(true,c.id)).cases[0];
 await assert.rejects(call('proposal',{id:c.id,revision:c.revision,proposal:p}),/CONFLICT/);
 await call('stage',{id:c.id,revision:c.revision,stage:'production',note:'Production réellement confirmée pour ce test'});c=(await view(true,c.id)).cases[0];
 await call('stage',{id:c.id,revision:c.revision,stage:'ready',note:'Fabricant confirme que les pièces sont prêtes'});c=(await view(true,c.id)).cases[0];
 await assert.rejects(call('stage',{id:c.id,revision:c.revision,stage:'shipped',note:'Tentative sans données de transport'}),/INCOMPLETE/);
 const partner=await call('partner',{name:'Partenaire fictif local',coverage:['TR'],contractConfirmed:true,note:'Contrat fictif du harness de test uniquement'});
 const shipment={originCountry:'TR',origin:'Site test Turquie',destination:'Montpellier FR 34000',packages:1,weightKg:'10',dimensions:'40 × 30 × 20 cm',goods:'Actionneurs et carte',constraints:'Aucune pour cet exemple',mode:'road',partnerId:partner.id,incoterm:'DAP',agreedPlace:'Site acheteur Montpellier',importerRole:'buyer',importerName:'Acheteur test',insurance:'Souscrite, police fictive',documents:['Facture','Liste de colisage'],trackingNumber:'TEST-001',trackingUrl:'https://example.invalid/tracking/TEST-001',note:'Expédition manuellement déclarée après confirmation'};
 await call('shipment',{id:c.id,revision:c.revision,shipment});c=(await view(true,c.id)).cases[0];
 for(const stage of ['shipped','delivered','closed']){await call('stage',{id:c.id,revision:c.revision,stage,note:'Événement confirmé manuellement dans la simulation isolée'});c=(await view(true,c.id)).cases[0];}
 assert.equal(c.stage,'closed');
 await as(outside,'aal1');assert.equal((await scalar('select count(*)::int from public.delivery_proposals')),0);assert.equal((await scalar('select count(*)::int from public.delivery_shipments')),0);await assert.rejects(view(false,c.id),/FORBIDDEN/);
 const payload=JSON.parse(await readFile('data/gsl-70-import-2026-10-13.json','utf8'));
 const importRows=()=>scalar('select public.import_component_candidates($1::jsonb)',[JSON.stringify(payload)]);
 await as(admin,'aal2');await assert.rejects(importRows(),/PERMISSION_REQUIRED/);
 await as(owner1,'aal2');assert.equal((await importRows()).imported,70);assert.equal((await importRows()).existing,true);const manufacturers=(await view(true)).manufacturers;assert.equal(manufacturers.length,70);
 await as(null,'aal1','anon');assert.equal(await scalar('select count(*)::int from public.sourcing_manufacturers'),0,'Staging is not public');
 await as(owner1,'aal2');const candidate=manufacturers.find(m=>m.name==='YMTM Teknoloji');
 await call('qualify',{id:candidate.id,revision:1,family:'actionnement-transmission',level:'explicit',productionChecked:true,delivery:'on_review',deliveryEvidence:'',publicEnabled:true,reviewNote:'Sources et réserves du tableau examinées dans le test.'});
 const fullRobot=manufacturers.find(m=>m.name==='Milvus Robotics');await assert.rejects(call('qualify',{id:fullRobot.id,revision:1,family:'actionnement-transmission',level:'explicit',productionChecked:true,delivery:'on_review',deliveryEvidence:'',publicEnabled:true,reviewNote:'Tentative de reclassification non étayée d’un robot complet'}),/INCOMPLETE/);
 await as(null,'aal1','anon');assert.equal(await scalar('select count(*)::int from public.component_products'),1);assert.equal((await scalar('select public.search_components_catalogue($1::jsonb)',[JSON.stringify({qualification:"explicit"})])).count,1);
 await assert.rejects(db.query('select reviewed_by from public.sourcing_manufacturers'),/permission denied/);
 await as(owner1,'aal2');const cert={name:'ISO 9001 — exemple de test',issuer:'Organisme fictif de test',scope:'Site de production fictif, sans conformité produit',url:'https://example.invalid/certificate-test',checkedAt:'2026-10-13',validUntil:'2030-12-31',note:'Données fictives en base isolée uniquement'};
 await call('qualify',{id:candidate.id,revision:2,family:'actionnement-transmission',level:'explicit',productionChecked:true,delivery:'on_review',deliveryEvidence:'',publicEnabled:true,reviewNote:'Justificatif examiné pour le test de filtrage documentaire',certifications:[cert]});
 await as(null,'aal1','anon');assert.equal((await scalar('select public.search_components_catalogue($1::jsonb)',[JSON.stringify({certification:'ISO 9001'})])).count,1);
 await as(ordinary,'aal1');const candidateDraft=await call('create',{...input,preferredManufacturer:candidate.id,items:[{candidate:candidate.id,description:'Actionneur documenté',quantity:'2',unit:'pcs'}]});assert.equal((await view(false,candidateDraft.id)).cases[0].preferred_manufacturer_name,'YMTM Teknoloji');
 await as(owner1,'aal2');await call('qualify',{id:candidate.id,revision:3,family:'actionnement-transmission',level:'explicit',productionChecked:true,delivery:'on_review',deliveryEvidence:'',publicEnabled:false,reviewNote:'Retrait conservatoire de la référence pour le test'});
 await as(ordinary,'aal1');await assert.rejects(call('submit',{id:candidateDraft.id,revision:1}),/INCOMPLETE/);
 await db.exec('reset role');assert.equal(await scalar('select count(*)::int from private.manufacturer_review_versions'),3);
 console.log('Sourcing: real 70-row staging, qualification, private drafts, consent, cross-buyer isolation, MFA/roles, quote versions, exact totals, acceptance, logistics gates, lifecycle and no payment simulation passed.');
}finally{await db.close();}
