import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

if(process.env.DATABASE_URL||process.env.SUPABASE_URL)throw Error('Hosted database configuration refused: in-memory fixture only');
const db=new PGlite();
const migration='20261009123337_curated_owner_messaging.sql';
const as=async(id,aal='aal2',role='authenticated')=>{
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id||'',aal]);
 await db.exec(`set role ${role}`);
};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const direct=(company,target,conversation,body,command=randomUUID())=>scalar('select public.send_direct_message($1,null,$2,$3,$4,$5)',[company,target,conversation,body,command]);
const workflow=(action,args,command=randomUUID())=>scalar('select public.workflow($1,$2,$3)',[action,JSON.stringify(args),command]);
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
 for(const name of (await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')&&name!==migration).sort()){
  try{await db.exec(await readFile('supabase/migrations/'+name,'utf8'))}catch(error){throw Error(`Migration ${name}: ${error.message}`)}
 }
 const [owner1,owner2,operator,buyer,outsider,unconfirmed,banned]=Array.from({length:7},()=>randomUUID());
 for(const id of [owner1,owner2,operator,buyer,outsider,unconfirmed,banned])await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,banned_until) values($1,$2,$3,$4,$5)',[id,id+'@example.invalid',id===unconfirmed?null:new Date(),JSON.stringify({role:'owner'}),id===banned?'2099-01-01':null]);
 for(const id of [owner1,owner2,unconfirmed,banned])await db.query("insert into private.platform_admins(user_id,role) values($1,'owner')",[id]);
 await db.query("insert into private.platform_admins(user_id,role) values($1,'operator')",[operator]);
 const buyerOrg=randomUUID(),ordinaryOrg=randomUUID();
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[buyer]);
 await db.query("insert into public.organizations(id,created_by,legal_name,country_code,entity_kind,buyer) values($1,$2,'Synthetic buyer','FR','company',true)",[buyerOrg,buyer]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner1]);
 await db.query("insert into public.organizations(id,created_by,legal_name,country_code,entity_kind,buyer) values($1,$2,'Ordinary membership control','FR','company',true)",[ordinaryOrg,owner1]);
 await db.query("insert into public.memberships(organization_id,user_id,role) values($1,$2,'procurement')",[ordinaryOrg,owner2]);
 const companies=Array.from({length:50},()=>randomUUID());
 for(const [index,id] of companies.entries()){
  await db.query("insert into public.organizations(id,created_by,legal_name,country_code,entity_kind,supplier) values($1,$2,$3,'MD','company',true)",[id,owner1,'Synthetic manufacturer '+index]);
  await db.query('delete from public.memberships where organization_id=$1 and user_id=$2',[id,owner1]);
  await db.query('insert into private.curated_catalogue_companies(organization_id,source_id,batch_id) values($1,$2,$3)',[id,'F'+String(index+1).padStart(3,'0'),'isolated-messaging-fixture']);
  await db.query("insert into public.published_supplier_profiles(organization_id,source_revision,display_name,country_code,city,description,public_details) values($1,1,$2,'MD','Test','Synthetic catalogue fixture only',$3)",[id,'Synthetic manufacturer '+index,JSON.stringify({verification:'sourced',research:{kind:'gsl_research'}})]);
 }
 await db.query("insert into public.memberships(organization_id,user_id,role) values($1,$2,'viewer')",[companies[0],outsider]);
 const legacy=randomUUID();
 await db.query("insert into public.product_conversations(id,buyer_organization_id,supplier_organization_id,buyer_name,supplier_name,product_name) values($1,$2,$3,'Synthetic buyer','Legacy test supplier','Contact direct')",[legacy,buyerOrg,companies[25]]);
 await db.query("insert into public.product_messages(conversation_id,sender_organization_id,sender_user_id,body,command_id,created_at) values($1,$2,$3,'Historical message; must not enqueue',gen_random_uuid(),now()-interval '1 day')",[legacy,buyerOrg,buyer]);
 await db.exec(await readFile('supabase/migrations/'+migration,'utf8'));
 assert.equal(await scalar('select count(*)::int from private.curated_catalogue_owner_memberships'),100,'Exactly two eligible owners across all 50 curated companies');
 assert.equal(await scalar("select count(*)::int from public.notification_outbox where template='direct_message'"),0,'No notification backfill for historical messages');
 assert.deepEqual(await scalar('select private.sync_curated_catalogue_owners()'),{added:0,removed:0},'Repeated sync is idempotent');
 assert.equal(await scalar("select count(*)::int from public.memberships where role='admin' and user_id=any($1::uuid[])",[[operator,outsider,unconfirmed,banned]]),0,'No metadata-based, inactive or nonowner grants');
 await as(null,'aal1','anon');await assert.rejects(db.query('select public.messaging_access()'),/permission denied/);
 await as(owner1,'aal1');
 assert.equal((await scalar('select public.messaging_access()')).mfaRequired,true);
 assert.equal(await scalar('select count(*)::int from public.product_conversations'),0,'Managed conversation requires AAL2');
 await assert.rejects(direct(companies[25],null,legacy,'AAL1 response'),/FORBIDDEN/);
 await assert.rejects(db.query('select private.sync_curated_catalogue_owners()'),/permission denied/);
 await as(buyer,'aal1');
 const command=randomUUID(),first=await direct(buyerOrg,companies[0],null,'First synthetic company enquiry',command);
 assert.deepEqual(await direct(buyerOrg,companies[0],null,'First synthetic company enquiry',command),first);
 await assert.rejects(direct(buyerOrg,companies[0],null,'Changed command body',command),/IDEMPOTENCY_CONFLICT/);
 const second=await direct(buyerOrg,companies[49],null,'Second synthetic company enquiry');
 await db.exec('reset role');
 const recipients=(await db.query("select recipient_id,recipient_organization_id from public.notification_outbox where template='direct_message' and resource_id=$1",[first.conversation])).rows;
 assert.deepEqual(recipients.map(row=>row.recipient_id).sort(),[owner1,owner2].sort(),'Both owners notified once; viewer/operator/inactive users excluded');
 assert.ok(recipients.every(row=>row.recipient_organization_id===companies[0]));
 for(const id of [owner1,owner2]){
  await as(id);
  const access=await scalar('select public.messaging_access()');assert.equal(access.mfaRequired,false);assert.equal(access.managedOrganizationIds.length,50);
  assert.equal(await scalar('select count(*)::int from public.product_conversations'),3,'Aggregate inbox includes conversations from three suppliers');
  const summaries=await scalar('select public.messaging_summary($1)',[[first.conversation,second.conversation]]);
  assert.equal(summaries.length,2);assert.ok(summaries.every(row=>row.supplier_managed_by_gsl&&row.unread===1));
 }
 await as(owner1);
 await assert.rejects(direct(buyerOrg,null,first.conversation,'Wrong buyer identity'),/FORBIDDEN/);
 await assert.rejects(direct(companies[49],null,first.conversation,'Wrong supplier identity'),/FORBIDDEN/);
 const reply=await direct(companies[0],null,first.conversation,'GSL reply for the correct supplier');
 await db.exec('reset role');
 assert.deepEqual((await db.query("select recipient_id from public.notification_outbox where event_key like $1",['direct-message:'+reply.message+':%'])).rows.map(row=>row.recipient_id),[buyer],'Reply goes to the other company only');
 await as(owner1);
 const self=await direct(ordinaryOrg,companies[10],null,'Synthetic owner-authored enquiry');
 await db.exec('reset role');
 assert.deepEqual((await db.query("select recipient_id from public.notification_outbox where event_key like $1",['direct-message:'+self.message+':%'])).rows.map(row=>row.recipient_id),[owner2],'Message author excluded even when member of recipient company');
 for(const id of [operator,outsider,unconfirmed,banned]){
  await as(id);assert.equal(await scalar('select count(*)::int from public.product_conversations'),0);
  assert.deepEqual(await scalar('select public.messaging_summary($1)',[[first.conversation]]),[]);
  await assert.rejects(direct(companies[0],null,first.conversation,'Unauthorized response'),id===unconfirmed?/LOGIN_REQUIRED/:/FORBIDDEN/);
 }
 await as(buyer);
 const rfq=await workflow('save_rfq',{organization:buyerOrg,title:'Synthetic CNC enquiry',details:'Synthetic specifications for isolated notification tests only.',destination:'FR',items:[{description:'Fixture part',quantity:'10',unit:'pcs'}]});
 const rfqCommand=randomUUID(),rfqArgs={id:rfq.id,revision:rfq.revision,recipients:[companies[0]]};
 await workflow('send_rfq',rfqArgs,rfqCommand);await workflow('send_rfq',rfqArgs,rfqCommand);
 await db.exec('reset role');
 const rfqJobs=(await db.query("select recipient_id,resource_id from public.notification_outbox where template='new_rfq'")).rows;
 assert.deepEqual(rfqJobs.map(row=>row.recipient_id).sort(),[owner1,owner2].sort(),'RFQ routes to the same two memberships without duplicates');
 await as(buyer);
 const secondRfq=await workflow('save_rfq',{organization:buyerOrg,title:'Synthetic second RFQ',details:'A request for a different manufacturer in the aggregate inbox.',destination:'FR',items:[{description:'Fixture part',quantity:'10',unit:'pcs'}]});
 await workflow('send_rfq',{id:secondRfq.id,revision:secondRfq.revision,recipients:[companies[49]]});
 const workspace=(company=null,request=null)=>scalar('select public.workspace_requests($1,0,$2)',[company,request]);
 for(const id of [owner1,owner2]){
  await as(id);const inbox=await workspace();assert.equal(inbox.total,2);assert.equal(inbox.threads.length,2,'RFQs across the first and last curated supplier are visible together');
  const focused=await workspace(companies[0],rfq.id);assert.equal(focused.rfqs.length,1);assert.ok(focused.threads.every(thread=>thread.supplier_organization_id===companies[0]));
  assert.equal((await workspace(companies[49],rfq.id)).total,0,'Unrelated response identity cannot select a request through a different owned company');
  assert.equal((await workspace(null,rfq.id)).total,1,'Email request link stays precise before selecting the response company');
 }
 const thread=rfqJobs[0].resource_id;
 await as(owner1);await assert.rejects(workflow('message',{thread,organization:companies[49],body:'Wrong RFQ response company'}),/FORBIDDEN/);
 await workflow('message',{thread,organization:companies[0],body:'Correct GSL RFQ response company'});
 await as(owner2);await workflow('offer',{thread,currency:'EUR',lines:[{quantity:'10',unit:'pcs',unitPriceMinor:'1200'}],validUntil:'2099-01-01',terms:'Synthetic test terms',leadTime:'Synthetic test lead time'});
 await as(owner1);assert.equal((await workspace(companies[0],rfq.id)).offers.length,1,'Both owners see the quote in the correct supplier conversation');
 for(const id of [owner1,owner2]){await as(id,'aal1');assert.equal((await workspace()).total,0);await assert.rejects(workspace(companies[0]),/FORBIDDEN/)}
 for(const id of [operator,outsider,unconfirmed,banned]){await as(id);assert.equal((await workspace()).total,0)}
 await as(null,'aal1','anon');await assert.rejects(workspace(),/permission denied/);
 const contact=randomUUID(),contactArgs=[contact,'synthetic@example.invalid','Synthetic contact','Fixture enquiry','Synthetic contact enquiry for isolated testing only.','fr'];
 await as(null,'aal1','anon');
 await db.query('select public.submit_contact($1,$2,$3,$4,$5,$6)',contactArgs);await db.query('select public.submit_contact($1,$2,$3,$4,$5,$6)',contactArgs);
 await db.exec('reset role');
 const contactJobs=(await db.query('select recipient_id,recipient_email,template from public.notification_outbox where resource_id=$1',[contact])).rows;
 assert.equal(contactJobs.length,3,'One acknowledgement and two owner notifications, idempotent');
 assert.deepEqual(contactJobs.filter(row=>row.template==='contact_operator').map(row=>row.recipient_id).sort(),[owner1,owner2].sort());
 assert.ok(contactJobs.filter(row=>row.template==='contact_operator').every(row=>row.recipient_email===null),'Owner emails are resolved privately at processing time');
 await db.query("update private.platform_admins set role='analyst' where user_id=$1",[owner2]);
 assert.equal(await scalar('select count(*)::int from private.curated_catalogue_owner_memberships where user_id=$1',[owner2]),0);
 assert.equal(await scalar('select count(*)::int from public.memberships where organization_id=$1 and user_id=$2',[ordinaryOrg,owner2]),1,'Revocation preserves ordinary pre-existing membership');
 await as(owner2);assert.equal(await scalar('select count(*)::int from public.product_conversations where id=$1',[first.conversation]),0);assert.equal((await workspace()).total,0);
 await as(null,'aal1','service_role');
 const claimed=await scalar('select public.claim_notifications($1)',[randomUUID()]);assert.ok(claimed.length>0);assert.ok(claimed.every(job=>job.email!==owner2+'@example.invalid'));
 await db.exec('reset role');
 assert.equal(await scalar("select count(*)::int from public.notification_outbox where recipient_id=$1 and state<>'failed'",[owner2]),0,'Pending jobs to the revoked owner cannot be claimed');
 assert.equal(await scalar("select count(*)::int from public.notification_outbox where recipient_id=$1 and failure_code='RECIPIENT_NO_LONGER_AUTHORIZED'",[owner2]),6);
 await db.query("update private.platform_admins set role='owner' where user_id=$1",[owner2]);
 for(const [field,value] of [['banned_until','2099-01-01'],['deleted_at','2026-01-01'],['email_confirmed_at',null]]){
  await db.query(`update auth.users set ${field}=$2 where id=$1`,[owner2,value]);
  assert.equal(await scalar('select count(*)::int from private.curated_catalogue_owner_memberships where user_id=$1',[owner2]),0,field+' deactivation removes derived memberships');
  await db.query(`update auth.users set ${field}=$2 where id=$1`,[owner2,field==='email_confirmed_at'?new Date():null]);
  assert.equal(await scalar('select count(*)::int from private.curated_catalogue_owner_memberships where user_id=$1',[owner2]),50,field+' reactivation restores live owner memberships');
 }
 await db.query('delete from private.curated_catalogue_companies where organization_id=$1',[companies[0]]);
 assert.equal(await scalar('select count(*)::int from public.memberships where organization_id=$1 and user_id=any($2::uuid[])',[companies[0],[owner1,owner2]]),0,'Removing catalogue provenance removes derived access');
 assert.equal(await scalar('select count(*)::int from public.memberships where organization_id=$1 and user_id=$2',[companies[0],outsider]),1,'Manual viewer membership remains untouched');
 console.log('Curated messaging: 50 companies × 2 owners; live role/MFA isolation; aggregate visibility; correct reply identity; direct/RFQ/contact deduplication; inactive/revoked recipient exclusion; no historical backfill.');
}catch(error){console.error(error.message,error.where||'',error.position||'');process.exitCode=1}
finally{await db.close()}
