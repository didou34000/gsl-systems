import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';

// Invoked with the isolated PGlite database after the complete migration history.
// This helper never accepts a hosted URL or inserts a real person's identity.
export async function testAdminOwnerOperation(db) {
  await db.exec('reset role');
  await db.exec('alter table auth.users add column if not exists banned_until timestamptz, add column if not exists deleted_at timestamptz');
  const operation = await readFile('supabase/operations/grant-platform-owner.sql', 'utf8');
  const serverActor = '00000000-0000-0000-0000-000000000000';
  const people = Object.fromEntries(['target', 'upgrade', 'unconfirmed', 'banned', 'deleted', 'duplicate', 'duplicateOther'].map(name => [name, {id: randomUUID(), email: `${randomUUID()}@example.invalid`}]));
  people.duplicateOther.email = people.duplicate.email.toUpperCase();
  for (const [name, person] of Object.entries(people)) {
    await db.query('insert into auth.users(id,email,email_confirmed_at,banned_until,deleted_at) values($1,$2,$3,$4,$5)', [person.id, person.email, name === 'unconfirmed' ? null : new Date(), name === 'banned' ? new Date(Date.now() + 86400000) : null, name === 'deleted' ? new Date() : null]);
  }
  await db.query("insert into private.platform_admins(user_id,role) values($1,'analyst')", [people.upgrade.id]);
  const reason = 'Explicit request by the verified account holder; controlled server operation.';
  const run = async (values = {}, {role, rollback = false} = {}) => {
    await db.exec('reset role');
    await db.exec('begin');
    try {
      if (role) await db.exec(`set local role ${role}`);
      for (const [setting, value] of Object.entries(values)) await db.query('select set_config($1,$2,true)', [`gsl.owner_grant_${setting}`, value]);
      await db.exec(operation);
      await db.exec(rollback ? 'rollback' : 'commit');
    } catch (error) {
      await db.exec('rollback');
      throw error;
    }
  };
  const inputs = person => ({user_id: person.id, email: person.email, reason});
  const revision = async () => (await db.query('select revision from private.admin_access_state where singleton')).rows[0].revision;
  const audit = async person => (await db.query('select actor_id,actor_email,target_email,action,previous_role,role,reason from private.admin_access_events where target_id=$1 order by created_at,id', [person.id])).rows;
  const reviewerAudit = async person => (await db.query("select actor_id,action,resource_id from public.operator_actions where resource_id=$1 and action='server_operation_reviewer_access_granted'", [person.id])).rows;
  const baselineRevision = await revision();
  await assert.rejects(run(), /OWNER_GRANT_CONFIG_REQUIRED/);
  for (const missing of ['user_id', 'email', 'reason']) {
    const values = inputs(people.target); delete values[missing];
    await assert.rejects(run(values), /OWNER_GRANT_CONFIG_REQUIRED/);
  }
  for (const values of [{...inputs(people.target), user_id: 'bad-id'}, {...inputs(people.target), email: 'not-an-email'}, {...inputs(people.target), reason: 'short'}, {...inputs(people.target), reason: 'x'.repeat(501)}, {...inputs(people.target), reason: '   '}]) {
    await assert.rejects(run(values), /OWNER_GRANT_CONFIG_INVALID|OWNER_GRANT_CONFIG_REQUIRED/);
  }
  await assert.rejects(run({...inputs(people.target), user_id: randomUUID()}), /OWNER_GRANT_USER_NOT_FOUND/);
  await assert.rejects(run({...inputs(people.target), email: people.upgrade.email}), /OWNER_GRANT_IDENTITY_MISMATCH/);
  await assert.rejects(run(inputs(people.duplicate)), /OWNER_GRANT_IDENTITY_MISMATCH/);
  await assert.rejects(run(inputs(people.unconfirmed)), /EMAIL_UNCONFIRMED/);
  await assert.rejects(run(inputs(people.banned)), /USER_INACTIVE/);
  await assert.rejects(run(inputs(people.deleted)), /USER_INACTIVE/);
  for (const role of ['anon', 'authenticated', 'service_role']) await assert.rejects(run(inputs(people.target), {role}), /SERVER_OPERATION_REQUIRED/);
  assert.equal(await revision(), baselineRevision, 'failed server operations do not mutate access revision');
  for (const person of Object.values(people)) {
    assert.deepEqual(await audit(person), []);
    assert.deepEqual(await reviewerAudit(person), []);
    assert.equal((await db.query('select count(*)::int n from private.platform_reviewers where user_id=$1', [person.id])).rows[0].n, 0);
  }
  await run(inputs(people.target), {rollback: true});
  assert.equal(await revision(), baselineRevision, 'caller rollback removes all grant changes');
  assert.deepEqual(await audit(people.target), []);
  assert.deepEqual(await reviewerAudit(people.target), []);
  assert.equal((await db.query('select count(*)::int n from private.platform_admins where user_id=$1', [people.target.id])).rows[0].n, 0);

  await run({...inputs(people.target), email: ` ${people.target.email.toUpperCase()} `});
  assert.equal(await revision(), baselineRevision + 1);
  assert.deepEqual(await audit(people.target), [{actor_id: serverActor, actor_email: 'server-operation:grant-platform-owner', target_email: people.target.email, action: 'access_granted', previous_role: null, role: 'owner', reason}]);
  assert.deepEqual(await reviewerAudit(people.target), [{actor_id: serverActor, action: 'server_operation_reviewer_access_granted', resource_id: people.target.id}]);
  await run(inputs(people.target));
  assert.equal(await revision(), baselineRevision + 1, 'repeat operation is idempotent');
  assert.equal((await audit(people.target)).length, 1);
  assert.equal((await reviewerAudit(people.target)).length, 1);
  await assert.rejects(run(), /OWNER_GRANT_CONFIG_REQUIRED/, 'SET LOCAL identity cannot leak into the next operation');

  await run(inputs(people.upgrade));
  assert.equal(await revision(), baselineRevision + 2);
  assert.deepEqual(await audit(people.upgrade), [{actor_id: serverActor, actor_email: 'server-operation:grant-platform-owner', target_email: people.upgrade.email, action: 'access_changed', previous_role: 'analyst', role: 'owner', reason}]);
  assert.equal((await reviewerAudit(people.upgrade)).length, 1);

  const asTarget = async (aal = 'aal2') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)", [people.target.id, aal]);
    await db.exec('set role authenticated');
  };
  const call = async name => (await db.query(`select public.${name}() value`)).rows[0].value;
  await asTarget('aal1');
  assert.deepEqual(await call('admin_access'), {isAdmin: true, canReview: false, mfaRequired: true});
  await assert.rejects(call('admin_snapshot'), /MFA_REQUIRED/);
  await assert.rejects(call('operations_overview'), /FORBIDDEN/);
  await assert.rejects(call('review_queue'), /FORBIDDEN/);
  await asTarget();
  const snapshot = await call('admin_snapshot');
  assert.equal(snapshot.viewer.role, 'owner');
  assert.equal(snapshot.viewer.reviewer, true);
  assert.deepEqual(snapshot.viewer.permissions, ['overview.read', 'catalog.read', 'contacts.read', 'contacts.manage', 'tasks.manage', 'activity.read', 'data.export', 'access.manage']);
  assert.ok(snapshot.access);
  assert.ok(await call('operations_overview'));
  assert.ok(await call('review_queue'));
  assert.deepEqual(await call('admin_access'), {isAdmin: true, canReview: true, mfaRequired: false});
  const exported = (await db.query("select public.admin_export('{\"resource\":\"overview\"}'::jsonb) value")).rows[0].value;
  assert.equal(exported.resource, 'overview');

  // A grant must not bypass live account checks, even with a previously issued AAL2 JWT.
  for (const [column, value] of [['email_confirmed_at', null], ['banned_until', new Date(Date.now() + 86400000)], ['deleted_at', new Date()]]) {
    await db.exec('reset role');
    await db.query(`update auth.users set ${column}=$1 where id=$2`, [value, people.target.id]);
    await asTarget();
    assert.deepEqual(await call('admin_access'), {isAdmin: false, canReview: false, mfaRequired: false});
    await assert.rejects(call('admin_snapshot'), /ADMIN_REQUIRED/);
    await assert.rejects(call('operations_overview'), /FORBIDDEN/);
    await assert.rejects(call('review_queue'), /FORBIDDEN/);
    await db.exec('reset role');
    await db.query(`update auth.users set ${column}=$1 where id=$2`, [column === 'email_confirmed_at' ? new Date() : null, people.target.id]);
  }
  await db.query("update auth.users set banned_until=now()-interval '1 day' where id=$1", [people.target.id]);
  await asTarget();
  assert.equal((await call('admin_access')).canReview, true, 'expired bans permit an active reviewer again');
  await db.exec('reset role');
  await assert.rejects(db.query('update private.admin_access_events set reason=$1 where target_id=$2', ['Attempted audit replacement', people.target.id]), /AUDIT_IMMUTABLE/);
  console.log('Owner operation PostgreSQL checks passed: strict transaction-local input, exact confirmed active identity, client denial, rollback, idempotency, role upgrade, server-attributed audit, all owner/reviewer capabilities, mandatory MFA and immediate reviewer suspension.');
}
