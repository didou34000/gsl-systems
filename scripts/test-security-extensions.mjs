import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testSecurityExtensions(db){
 const [owner,recipient,intruder]=Array.from({length:3},()=>randomUUID());
 await db.exec('reset role');for(const id of [owner,recipient,intruder])await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.invalid']);
 async function as(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)}
 const work=async(action,args)=>(await db.query('select public.workflow($1,$2,$3) result',[action,JSON.stringify(args),randomUUID()])).rows[0].result;
 const members=async(action,args,key=randomUUID())=>(await db.query('select public.manage_members($1,$2,$3) result',[action,JSON.stringify(args),key])).rows[0].result;
 await as(owner);const org=(await work('buyer_company',{name:'Isolated team test',country:'FR'})).organizationId;
 const invitation=await members('invite_member',{organization:org,email:recipient+'@example.invalid',role:'procurement'});
 await as(intruder);assert.equal((await db.query('select * from public.organization_invitations where id=$1',[invitation.id])).rows.length,0);await assert.rejects(members('accept_invitation',{id:invitation.id}),/FORBIDDEN/);
 await as(recipient);assert.equal((await db.query('select * from public.organization_invitations where id=$1',[invitation.id])).rows.length,1);const key=randomUUID();await members('accept_invitation',{id:invitation.id},key);await members('accept_invitation',{id:invitation.id},key);
 assert.equal((await db.query('select * from public.organizations where id=$1',[org])).rows.length,1);await assert.rejects(members('invite_member',{organization:org,email:intruder+'@example.invalid',role:'admin'}),/FORBIDDEN/);
 await as(owner);await members('remove_member',{organization:org,user:recipient});await assert.rejects(members('remove_member',{organization:org,user:owner}),/FORBIDDEN/);
 await as(recipient);assert.equal((await db.query('select * from public.organizations where id=$1',[org])).rows.length,0);
 await as(owner);await db.query("insert into public.supplier_applications(owner_id,payload) values(auth.uid(),'{}')");
 const upload=async(action,args)=>(await db.query('select public.manage_upload($1,$2) result',[action,JSON.stringify(args)])).rows[0].result;
 const reserved=[];for(let i=0;i<40;i++)reserved.push(await upload('reserve',{kind:'registration',name:'synthetic.pdf',size:25,extension:'pdf'}));
 await assert.rejects(upload('reserve',{kind:'registration',name:'synthetic.pdf',size:25,extension:'pdf'}),/FILE_LIMIT/);
 await assert.rejects(db.query("update public.supplier_applications set status='submitted' where owner_id=auth.uid()"),/FILES_PENDING/);
 await assert.rejects(db.query("insert into public.supplier_application_files(id,owner_id,object_path,kind,name,size) values($1,auth.uid(),'arbitrary','registration','x',1)",[randomUUID()]));
 await as(intruder);await assert.rejects(db.query("insert into storage.objects(bucket_id,name,metadata) values('gsl-onboarding',$1,'{\"size\":25}')",[reserved[0].path]));
 await as(owner);await db.query("insert into storage.objects(bucket_id,name,metadata) values('gsl-onboarding',$1,'{\"size\":24}')",[reserved[0].path]);await assert.rejects(upload('finalize',{id:reserved[0].id}),/UPLOAD_NOT_CONFIRMED/);
 await db.query("delete from storage.objects where name=$1",[reserved[0].path]);await db.query("insert into storage.objects(bucket_id,name,metadata) values('gsl-onboarding',$1,'{\"size\":25}')",[reserved[0].path]);await upload('finalize',{id:reserved[0].id});
 assert.equal((await db.query('select scan_state from public.onboarding_uploads where id=$1',[reserved[0].id])).rows[0].scan_state,'quarantined');
 // Ready objects cannot be deleted through Storage without a recorded delete intent.
 await db.query('delete from storage.objects where name=$1',[reserved[0].path]);assert.equal((await db.query('select * from storage.objects where name=$1',[reserved[0].path])).rows.length,1);
 await upload('delete',{id:reserved[0].id});await assert.rejects(upload('removed',{id:reserved[0].id}),/DELETE_NOT_CONFIRMED/);
 await db.query('delete from storage.objects where name=$1',[reserved[0].path]);await upload('removed',{id:reserved[0].id});assert.equal((await db.query('select * from public.supplier_application_files')).rows.length,0);
 await as('', 'anon');const cid=randomUUID();const email='contact-fixture@example.invalid';
 const contact=(id,e=email)=>(db.query("select public.submit_contact($1,$2,'Synthetic user','Synthetic contact','This is an isolated test enquiry only.','fr')",[id,e]));
 await contact(cid);await contact(cid);await contact(randomUUID());await contact(randomUUID());await assert.rejects(contact(randomUUID()),/RATE_LIMITED/);await assert.rejects(db.query('select * from public.contact_requests'));
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.contact_requests where email=$1',[email])).rows[0].n,3);
 console.log('Security extensions passed: recipient-bound invitations, revoked access, quota reservations, pending submission lock, file owner/type-size metadata boundaries, delete coordination, contact rate limits and idempotence.');
}
