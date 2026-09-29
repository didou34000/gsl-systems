import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testRequestFiles(db){
 const users=Array.from({length:3},()=>randomUUID());await db.exec('reset role');for(const u of users)await db.query('insert into auth.users(id,email) values($1,$2)',[u,u+'@example.invalid']);
 async function as(u,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);await db.exec('set role '+role)}
 const command=async(action,args)=>(await db.query('select public.workflow($1,$2,$3) value',[action,JSON.stringify(args),randomUUID()])).rows[0].value;
 const file=async(action,args)=>(await db.query('select public.manage_rfq_file($1,$2) value',[action,JSON.stringify(args)])).rows[0].value;
 const orgs=[];for(const [i,u] of users.entries()){await as(u);orgs.push((await command('buyer_company',{name:'Attachment synthetic '+i,country:'FR'})).organizationId)}
 await db.exec('reset role');for(const org of orgs.slice(1))await db.query("insert into public.published_supplier_profiles(organization_id,source_revision,display_name,country_code,city,description) values($1,1,'Synthetic supplier','FR','Test','Test')",[org]);
 await as(users[0]);const draft=await command('save_rfq',{organization:orgs[0],title:'Attachment test',destination:'FR',details:'An isolated file sharing test.',items:[{description:'Test',quantity:'10',unit:'pcs'}]});
 const reserved=await file('reserve',{rfq:draft.id,name:'private.pdf',size:10,mime:'application/pdf',recipient:orgs[1]});
 await assert.rejects(command('send_rfq',{id:draft.id,revision:draft.revision,recipients:orgs.slice(1)}),/FILES_PENDING/);
 assert.equal((await db.query('select * from public.threads where rfq_id=$1',[draft.id])).rows.length,0,'pending file rolls back the whole send');
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('gsl-private',$1,'{\"size\":10}')",[reserved.path]);
 await file('finalize',{rfq:draft.id,id:reserved.id});
 await assert.rejects(db.query("select public.record_file_scan($1,'clean')",[reserved.id]));
 await as(users[0],'service_role');await db.query("select public.record_file_scan($1,'clean')",[reserved.id]);await as(users[0]);
 await command('send_rfq',{id:draft.id,revision:draft.revision,recipients:orgs.slice(1)});
 await as(users[1]);assert.equal((await db.query('select * from public.files where id=$1',[reserved.id])).rows.length,1);assert.equal((await db.query('select * from storage.objects where name=$1',[reserved.path])).rows.length,1);
 await as(users[2]);assert.equal((await db.query('select * from public.files where id=$1',[reserved.id])).rows.length,0);assert.equal((await db.query('select * from public.rfq_files where file_id=$1',[reserved.id])).rows.length,0);assert.equal((await db.query('select * from storage.objects where name=$1',[reserved.path])).rows.length,0,'other recipient cannot download scoped drawing');
 await assert.rejects(file('delete',{rfq:draft.id,id:reserved.id}),/FORBIDDEN/);await as(users[0]);await assert.rejects(file('delete',{rfq:draft.id,id:reserved.id}),/FORBIDDEN/);await db.exec('reset role');
 console.log('Scoped attachments: pending scan blocks atomic send, only trusted scanner may mark clean, competitors cannot read metadata or Storage objects, sent attachments immutable.');
}
