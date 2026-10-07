import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

export async function testAdminRoles(db) {
  await db.exec('reset role');
  await db.exec('alter table auth.users add column if not exists banned_until timestamptz, add column if not exists deleted_at timestamptz');
  const source=ts.transpileModule(await readFile('lib/admin/permissions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {rolePermissions}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const identities=Object.fromEntries(['owner','admin','operator','analyst','candidate','unconfirmed','newOwner'].map(key=>[key,randomUUID()]));
  const emails=Object.fromEntries(Object.entries(identities).map(([role,id])=>[role,id+'@example.invalid']));
  for(const [role,id] of Object.entries(identities)) await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)',[id,emails[role],role==='unconfirmed'?null:new Date(),JSON.stringify({role:'owner',permissions:['access.manage','data.export']})]);
  for(const role of ['owner','admin','operator','analyst']) await db.query('insert into private.platform_admins(user_id,role) values($1,$2)',[identities[role],role]);
  const contact=randomUUID(),taskIds={};
  await db.query("insert into public.contact_requests(id,email,name,subject,body,language) values($1,'private-contact@example.invalid','Private sender','Restricted contact','Restricted message body used for permissions testing.','ar')",[contact]);
  for(const role of ['owner','admin','operator','analyst']){
    const id=randomUUID();taskIds[role]=id;
    await db.query("insert into private.admin_tasks(id,owner_id,title,status,priority,position) values($1,$2,$3,'todo','medium',0)",[id,identities[role],role+' private task']);
    await db.query("insert into private.admin_events(actor_id,owner_id,action,resource_id) values($1,$1,'task_create',$2)",[identities[role],id]);
  }
  const contactEvent=randomUUID(),reviewEvent=randomUUID(),unknownEvent=randomUUID();
  await db.query("insert into private.admin_events(id,actor_id,action,resource_id) values($1,$2,'contact_resolved',$3)",[contactEvent,identities.owner,contact]);
  await db.query("insert into public.operator_actions(id,actor_id,action,resource_id) values($1,$2,'review_claimed',$3),($4,$2,'future_private_action',$3)",[reviewEvent,identities.owner,randomUUID(),unknownEvent]);
  const as=async(role,aal='aal2')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[identities[role]??'',aal]);await db.exec('set role '+(role==='anonymous'?'anon':'authenticated'));};
  const call=async(name,input)=>(await db.query(input===undefined?`select public.${name}() result`:`select public.${name}($1::jsonb) result`,input===undefined?[]:[input===null?null:JSON.stringify(input)])).rows[0].result;
  const snapshot=()=>call('admin_snapshot');
  const mutate=input=>call('admin_mutate',input);
  const exported=resource=>call('admin_export',{resource});
  const grant=(email,role,accessRevision=0)=>({action:'access.grant',email,role,reason:'Required for the stated administration responsibilities.',accessRevision});
  const change=(userId,role,accessRevision)=>({action:'access.change',userId,role,reason:'Responsibilities changed after an internal review.',accessRevision});
  const revoke=(userId,accessRevision)=>({action:'access.revoke',userId,reason:'Administration responsibilities have now ended.',accessRevision});
  const task=(role,revision=0)=>({action:'task.update',revision,id:taskIds[role],title:'Updated own task',description:'',status:'done',priority:'low',dueDate:null});
  const resources=['overview','companies','products','contacts','activity','tasks'];
  for(const flag of ['banned_until','deleted_at']){
    await db.exec('reset role');await db.query(`update auth.users set ${flag}=now()+interval '1 day' where id=$1`,[identities.admin]);
    await as('admin');
    assert.deepEqual(await call('admin_access'),{isAdmin:false,canReview:false,mfaRequired:false});
    await assert.rejects(snapshot(),/ADMIN_REQUIRED/);
    await assert.rejects(exported('contacts'),/ADMIN_REQUIRED/);
    await assert.rejects(mutate({action:'preferences.update',revision:0,widgetOrder:['tasks','contacts','activity','catalog']}),/ADMIN_REQUIRED/);
    await db.exec('reset role');await db.query(`update auth.users set ${flag}=null where id=$1`,[identities.admin]);
  }
  await db.query("update auth.users set banned_until=now()-interval '1 day' where id=$1",[identities.admin]);
  await as('admin');assert.equal((await snapshot()).viewer.role,'admin','expired bans permit live confirmed grants again');
  for(const role of ['owner','admin','operator','analyst']){
    await as(role);const s=await snapshot();
    assert.equal(s.viewer.role,role);
    assert.deepEqual(s.viewer.permissions,[...rolePermissions[role]],'SQL and frontend permission presets must agree');
    assert.equal(Boolean(s.access),role==='owner');
    assert.equal(s.tasks.length,1);assert.equal(s.tasks[0].id,taskIds[role]);
    assert.ok(!s.activity.some(e=>e.id===reviewEvent||e.id===unknownEvent),'review and unknown event classes are not disclosed by an admin role');
    assert.equal(s.activity.some(e=>e.id===contactEvent),role!=='analyst');
    assert.ok(!s.activity.some(e=>Object.entries(taskIds).some(([other,id])=>other!==role&&e.resourceId===id)));
    if(role==='analyst'){assert.deepEqual(s.contacts,[]);assert.equal(s.totals.contacts,0);assert.ok(!JSON.stringify(s).includes('private-contact@example.invalid'));}
    else assert.ok(s.contacts.some(c=>c.id===contact));
    for(const resource of resources){
      if(role==='operator'||role==='analyst')await assert.rejects(exported(resource),/PERMISSION_REQUIRED/);
      else {const data=await exported(resource);assert.equal(data.resource,resource);assert.equal(data.rowLimit,5000);assert.equal(data.truncated,false);assert.ok(Array.isArray(data.rows));if(resource==='tasks'){assert.equal(data.rows.length,1);assert.equal(data.rows[0].id,taskIds[role]);}if(resource==='overview')assert.ok(data.rows.every(row=>typeof row.name==='string'&&typeof row.value==='number'));if(resource==='activity')assert.ok(!data.rows.some(row=>row.id===reviewEvent||row.id===unknownEvent));}
    }
    if(role!=='owner')await assert.rejects(mutate(grant(emails.candidate,'owner')),/PERMISSION_REQUIRED/);
    // New policies cannot be bypassed by calling an earlier private implementation.
    for(const [fn,arg] of [['admin_snapshot_before_roles',undefined],['admin_mutate_before_roles',task(role)],['admin_access_mutate',grant(emails.candidate,'owner')]])await assert.rejects(db.query(arg===undefined?`select private.${fn}()`:`select private.${fn}($1::jsonb)`,arg===undefined?[]:[JSON.stringify(arg)]),/permission denied/);
    for(const table of ['platform_admins','admin_access_state','admin_access_events','admin_export_events'])await assert.rejects(db.query(`select * from private.${table}`),/permission denied/);
  }
  await as('analyst');
  for(const command of [task('analyst'),{...task('analyst'),action:'task.create',id:randomUUID()},{action:'task.delete',revision:0,id:taskIds.analyst},{action:'tasks.reorder',revision:0,tasks:[{id:taskIds.analyst,status:'done'}]},{action:'contact.resolve',id:contact,resolved:true,expectedResolvedAt:null}])await assert.rejects(mutate(command),/PERMISSION_REQUIRED/);
  let state=await mutate({action:'preferences.update',revision:0,widgetOrder:['tasks','contacts','activity','catalog']});
  assert.equal(state.revision,1);assert.deepEqual(state.preferences.widgetOrder,['tasks','contacts','activity','catalog']);
  await as('operator');state=await mutate(task('operator'));assert.equal(state.tasks[0].title,'Updated own task');
  state=await mutate({action:'contact.resolve',id:contact,resolved:true,expectedResolvedAt:null});assert.ok(state.contacts.find(c=>c.id===contact).resolvedAt);
  await as('owner','aal1');await assert.rejects(exported('overview'),/MFA_REQUIRED/);await assert.rejects(mutate(grant(emails.candidate,'admin')),/MFA_REQUIRED/);
  await as('candidate');await assert.rejects(snapshot(),/ADMIN_REQUIRED/);await assert.rejects(exported('contacts'),/ADMIN_REQUIRED/);
  await as('anonymous');await assert.rejects(exported('contacts'),/permission denied/);
  await as('owner');
  for(const bad of [null,{},[],{resource:null},{resource:'documents'},{resource:'contacts',ownerId:identities.operator}])await assert.rejects(call('admin_export',bad),/INVALID/);
  const validGrant=grant(emails.candidate,'operator');
  for(const field of ['action','email','role','reason','accessRevision'])await assert.rejects(mutate({...validGrant,[field]:null}),/INVALID/);
  for(const bad of [null,{},[],{...validGrant,reason:'short'},{...validGrant,reason:' '.repeat(20)},{...validGrant,reason:'x'.repeat(501)},{...validGrant,accessRevision:-1},{...validGrant,role:'superuser'},{...validGrant,email:'invalid'},{...validGrant,permissions:['access.manage']},{...change(identities.admin,'owner',0),userId:null}])await assert.rejects(mutate(bad),/INVALID/);
  await assert.rejects(mutate(grant('no-such-user@example.invalid','admin')),/USER_NOT_FOUND/);
  await assert.rejects(mutate(grant(emails.unconfirmed,'admin')),/EMAIL_UNCONFIRMED/);
  for(const flag of ['banned_until','deleted_at']){
    await db.exec('reset role');await db.query(`update auth.users set ${flag}=now()+interval '1 day' where id in ($1,$2)`,[identities.candidate,identities.admin]);
    await as('owner');
    await assert.rejects(mutate(grant(emails.candidate,'admin')),/USER_INACTIVE/);
    await assert.rejects(mutate(change(identities.admin,'analyst',0)),/USER_INACTIVE/);
    await db.exec('reset role');await db.query(`update auth.users set ${flag}=null where id in ($1,$2)`,[identities.candidate,identities.admin]);
    await as('owner');
  }
  await assert.rejects(mutate(grant(emails.admin,'admin')),/ALREADY_GRANTED/);
  await assert.rejects(mutate(grant(emails.owner,'admin')),/SELF_ACCESS_CHANGE/);
  await assert.rejects(mutate(change(identities.owner,'analyst',0)),/SELF_ACCESS_CHANGE/);
  await assert.rejects(mutate(revoke(identities.owner,0)),/SELF_ACCESS_CHANGE/);
  state=await snapshot();assert.equal(state.access.revision,0);assert.deepEqual(state.access.events,[]);
  state=await mutate(grant(' '+emails.candidate.toUpperCase()+' ','operator'));
  assert.equal(state.access.revision,1);assert.equal(state.access.members.find(m=>m.userId===identities.candidate).role,'operator');
  assert.equal(state.access.events[0].targetEmail,emails.candidate);assert.equal(state.access.events[0].previousRole,null);assert.equal(state.access.events[0].action,'access_granted');
  await assert.rejects(mutate(change(identities.candidate,'admin',0)),/CONFLICT/);
  state=await mutate(change(identities.candidate,'admin',1));assert.equal(state.access.revision,2);
  await as('candidate');assert.equal((await snapshot()).viewer.role,'admin');await exported('contacts');
  await as('owner');state=await mutate(change(identities.candidate,'analyst',2));assert.equal(state.access.revision,3);
  await as('candidate');assert.deepEqual((await snapshot()).contacts,[]);await assert.rejects(exported('overview'),/PERMISSION_REQUIRED/);
  await as('owner');state=await mutate(grant(emails.newOwner,'owner',3));assert.equal(state.access.revision,4);
  await as('newOwner');assert.equal((await snapshot()).viewer.role,'owner');
  await as('owner');state=await mutate(change(identities.newOwner,'operator',4));assert.equal(state.access.revision,5);
  const contested=await Promise.allSettled([mutate(change(identities.candidate,'operator',5)),mutate(change(identities.candidate,'admin',5))]);
  assert.equal(contested.filter(r=>r.status==='fulfilled').length,1);assert.equal(contested.filter(r=>r.status==='rejected'&&/CONFLICT/.test(r.reason.message)).length,1);
  state=await mutate(revoke(identities.candidate,6));assert.equal(state.access.revision,7);assert.ok(!state.access.members.some(m=>m.userId===identities.candidate));
  await as('candidate');await assert.rejects(snapshot(),/ADMIN_REQUIRED/);
  await as('owner');state=await snapshot();assert.equal(state.access.events.length,7);assert.ok(state.access.events.every(e=>e.reason.length>=10));
  await as('admin');assert.equal((await snapshot()).access,null);assert.ok(!(await snapshot()).activity.some(e=>e.action.startsWith('access_')));
  await db.exec('reset role');
  await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[identities.newOwner]);
  await as('owner');state=await mutate(revoke(identities.newOwner,7));assert.equal(state.access.revision,8,'inactive grants can still be revoked');
  await db.exec('reset role');
  await db.query('delete from auth.users where id=$1',[identities.candidate]);
  await as('candidate');await assert.rejects(snapshot(),/ADMIN_REQUIRED/);
  await db.exec('reset role');
  await db.query("insert into public.contact_requests(id,email,name,subject,body,language) select gen_random_uuid(),'bounded-'||g||'@example.invalid','Export fixture','Bounded export','Synthetic inquiry used only to verify the export limit.','en' from generate_series(1,5001) g");
  await as('owner');const bounded=await exported('contacts');assert.equal(bounded.rows.length,5000);assert.equal(bounded.truncated,true);assert.equal(bounded.rowLimit,5000);
  await db.exec('reset role');
  assert.ok((await db.query("select count(*)::int n from private.admin_export_events where actor_id=$1 and resource='contacts' and row_count=5000 and truncated",[identities.owner])).rows[0].n>0);
  assert.equal((await db.query('select count(*)::int n from private.admin_export_events where actor_id=$1',[identities.operator])).rows[0].n,0,'denied export attempts do not produce successful-export audit rows');
  for(const table of ['admin_access_events','admin_export_events']){
    await assert.rejects(db.query(`update private.${table} set actor_id=$1`,[identities.owner]),/AUDIT_IMMUTABLE/);
    await assert.rejects(db.query(`delete from private.${table}`),/AUDIT_IMMUTABLE/);
    await assert.rejects(db.query(`truncate private.${table}`),/AUDIT_IMMUTABLE/);
  }
  await assert.rejects(db.query('delete from private.platform_admins where user_id=$1',[identities.owner]),/LAST_OWNER/);
  await assert.rejects(db.query("update private.platform_admins set role='admin' where user_id=$1",[identities.owner]),/LAST_OWNER/);
  console.log('Admin RBAC PostgreSQL checks passed: role matrix, SQL/frontend parity, contact and activity redaction, personal task visibility, grants/change/revoke, exact confirmed email binding, no self-change/last-owner removal, immutable audit, stale access conflicts, exports and immediate permission revocation.');
}
