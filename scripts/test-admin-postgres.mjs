import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
process.on('uncaughtException', error => {console.error(error.message, error.where ?? '', error.position ?? '', error.stack?.split('\n').slice(1, 3).join('\n') ?? '');process.exit(1);});

// Fixtures are always isolated in memory and never accept a hosted database URL.
if (process.env.DATABASE_URL || process.env.SUPABASE_URL) throw Error('External database configuration refused for fixtures');
const db = new PGlite();
await db.exec(`
create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1'))$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
grant usage on schema public,auth,storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;`);
try {
  for (const name of (await readdir('supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
  }
  const [admin, otherAdmin, member, reviewer, unconfirmed] = Array.from({length: 5}, () => randomUUID());
  for (const id of [admin, otherAdmin, member, reviewer, unconfirmed]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)', [id, `${id}@example.invalid`, id === unconfirmed ? null : new Date(), JSON.stringify({role: 'admin', email: 'Dorian.viatou@gmail.com'})]);
  }
  for (const id of [admin, otherAdmin, unconfirmed]) await db.query('insert into private.platform_admins(user_id) values($1)', [id]);
  await db.query('insert into private.platform_reviewers(user_id) values($1)', [reviewer]);
  const company = randomUUID(), product = randomUUID(), contact = randomUUID();
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [member]);
  await db.query("insert into public.organizations(id,created_by,legal_name,country_code,entity_kind,supplier) values($1,$2,'Private legal name','FR','company',true)", [company, member]);
  await db.query("insert into public.products(id,organization_id,name,model_reference,category,specifications) values($1,$2,'Private specification name','REF','metal',$3)", [product, company, JSON.stringify({privateCost: 1000})]);
  await db.query("insert into public.published_supplier_profiles(organization_id,source_revision,display_name,country_code,city,description,public_details) values($1,1,'Public company','FR','Paris','Public description',$2)", [company, JSON.stringify({verification: 'unverified', privateTestMarker: 'must not appear'})]);
  await db.query("insert into public.published_products(product_id,organization_id,source_revision,name,category,description,specifications) values($1,$2,1,'Public product','metal','Public description',$3)", [product, company, JSON.stringify({verification: 'unverified'})]);
  await db.query("insert into public.contact_requests(id,email,name,subject,body,language) values($1,'contact@example.invalid','A contact','An inquiry','A synthetic inquiry body for this test.','fr')", [contact]);
  const as = async (id, aal = 'aal2', role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)", [id ?? '', aal]);
    await db.exec(`set role ${role}`);
  };
  const call = async (name, input) => (await db.query(input === undefined ? `select public.${name}() value` : `select public.${name}($1::jsonb) value`, input === undefined ? [] : [JSON.stringify(input)])).rows[0].value;
  const snapshot = () => call('admin_snapshot');
  const mutate = input => call('admin_mutate', input);
  const task = (revision, id = randomUUID(), overrides = {}) => ({action: 'task.create', revision, id, title: 'Verify a supplier', description: 'Call the listed business contact', status: 'todo', priority: 'medium', dueDate: '2026-10-31', ...overrides});

  await as(null, 'aal1', 'anon');
  await assert.rejects(snapshot(), /permission denied/);
  await as(null);
  await assert.rejects(snapshot(), /LOGIN_REQUIRED/);
  for (const id of [member, reviewer, unconfirmed]) {
    await as(id);
    assert.equal((await call('admin_access')).isAdmin, false);
    await assert.rejects(snapshot(), /ADMIN_REQUIRED/);
    await assert.rejects(mutate(task(0)), /ADMIN_REQUIRED/);
  }
  await as(admin, 'aal1');
  assert.deepEqual(await call('admin_access'), {isAdmin: true, canReview: false, mfaRequired: true});
  await assert.rejects(snapshot(), /MFA_REQUIRED/);
  await assert.rejects(mutate(task(0)), /MFA_REQUIRED/);
  await as(admin);
  for (const table of ['platform_admins', 'admin_workspaces', 'admin_tasks', 'admin_events']) await assert.rejects(db.query(`select * from private.${table}`), /permission denied/);
  await assert.rejects(db.query('insert into private.platform_admins(user_id) values($1)', [member]), /permission denied/);
  let state = await snapshot();
  assert.deepEqual(state.viewer, {id: admin, email: `${admin}@example.invalid`, reviewer: false, role: 'admin', permissions: ['overview.read', 'catalog.read', 'contacts.read', 'contacts.manage', 'tasks.manage', 'activity.read', 'data.export']});
  assert.equal(state.access, null, 'existing grants are admins, never automatically owners');
  assert.equal(state.stats.users, 5);
  assert.equal(state.stats.publishedCompanies, 1);
  assert.equal(state.stats.publishedProducts, 1);
  assert.equal(state.stats.openContacts, 1);
  assert.equal(state.trend.length, 30);
  assert.equal(state.trend.reduce((n, d) => n + d.companies, 0), 1);
  assert.equal(state.trend.reduce((n, d) => n + d.products, 0), 1);
  assert.equal(state.trend.reduce((n, d) => n + d.contacts, 0), 1);
  assert.equal(state.companies[0].name, 'Public company');
  assert.equal(state.products[0].name, 'Public product');
  assert.ok(!JSON.stringify(state).includes('Private legal name'));
  assert.ok(!JSON.stringify(state).includes('privateCost'));
  assert.ok(!JSON.stringify(state).includes('must not appear'));
  assert.equal(state.revision, 0);
  const first = randomUUID(), second = randomUUID();
  state = await mutate(task(0, first));
  assert.equal(state.revision, 1);
  assert.equal(state.tasks[0].id, first);
  await assert.rejects(mutate(task(0)), /CONFLICT/);
  state = await mutate(task(1, second));
  const invalid = [task(2, randomUUID(), {title: ' '}), task(2, randomUUID(), {dueDate: '2026-02-30'}), task(2, randomUUID(), {priority: 'critical'}), task(2, randomUUID(), {owner_id: otherAdmin}), {action: 'preferences.update', revision: 2, widgetOrder: ['tasks', 'tasks', 'activity', 'catalog']}, {action: 'tasks.reorder', revision: 2, tasks: [{id: first, status: 'todo'}, {id: first, status: 'done'}]}];
  for (const command of invalid) await assert.rejects(mutate(command), /INVALID|CONFLICT/);
  assert.equal((await snapshot()).revision, 2, 'failed mutations roll back revision and content');
  state = await mutate({action: 'tasks.reorder', revision: 2, tasks: [{id: second, status: 'in_progress'}, {id: first, status: 'done'}]});
  assert.deepEqual(state.tasks.map(t => [t.id, t.status, t.position]), [[second, 'in_progress', 0], [first, 'done', 1]]);
  state = await mutate({action: 'preferences.update', revision: 3, widgetOrder: ['tasks', 'contacts', 'catalog', 'activity']});
  assert.deepEqual(state.preferences.widgetOrder, ['tasks', 'contacts', 'catalog', 'activity']);
  assert.equal(state.revision, 4);
  await as(otherAdmin);
  assert.equal((await snapshot()).tasks.length, 0);
  assert.equal((await snapshot()).activity.filter(a => a.action.startsWith('task')).length, 0, 'another administrator cannot read private task events');
  await assert.rejects(mutate({...task(0, first), action: 'task.update'}), /NOT_FOUND/);
  await assert.rejects(mutate({action: 'task.delete', revision: 0, id: first}), /NOT_FOUND/);
  await assert.rejects(mutate({action: 'tasks.reorder', revision: 0, tasks: [{id: first, status: 'done'}]}), /CONFLICT/);
  await as(admin);
  state = await mutate({...task(4, second), action: 'task.update', title: 'Updated', dueDate: null});
  assert.equal(state.tasks.find(t => t.id === second).title, 'Updated');
  assert.equal(state.tasks.find(t => t.id === second).dueDate, null);
  state = await mutate({action: 'contact.resolve', id: contact, resolved: true, expectedResolvedAt: null});
  assert.equal(state.stats.openContacts, 0);
  assert.equal(state.revision, 5, 'shared contact changes do not change private workspace revision');
  const resolvedAt = state.contacts[0].resolvedAt;
  assert.ok(resolvedAt);
  await assert.rejects(mutate({action: 'contact.resolve', id: contact, resolved: false, expectedResolvedAt: null}), /CONFLICT/);
  state = await mutate({action: 'contact.resolve', id: contact, resolved: false, expectedResolvedAt: resolvedAt});
  assert.equal(state.stats.openContacts, 1);
  assert.equal(state.contacts[0].resolvedAt, null);
  await assert.rejects(mutate({action: 'contact.resolve', id: randomUUID(), resolved: true, expectedResolvedAt: null}), /NOT_FOUND/);
  state = await mutate({action: 'task.delete', revision: 5, id: first});
  assert.equal(state.tasks.length, 1);
  assert.equal(state.revision, 6);
  const competing = await Promise.allSettled([
    mutate({...task(6, second), action: 'task.update', title: 'Concurrent A'}),
    mutate({...task(6, second), action: 'task.update', title: 'Concurrent B'}),
  ]);
  assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(competing.filter(result => result.status === 'rejected' && /CONFLICT/.test(result.reason.message)).length, 1);
  assert.equal((await snapshot()).revision, 7);
  await db.exec('reset role');
  await db.query('delete from private.platform_admins where user_id=$1', [admin]);
  await as(admin);
  await assert.rejects(snapshot(), /ADMIN_REQUIRED/, 'revocation is checked against database, not cached JWT metadata');
  console.log('Admin PostgreSQL checks passed: real counts, public-field whitelist, role/MFA/confirmation gates, direct-table denial, task isolation, CRUD, reorder, preferences, contact reopen, validation, rollback, stale revisions and revocation.');
  await (await import('./test-admin-roles.mjs')).testAdminRoles(db);
  await (await import('./test-admin-owner-operation.mjs')).testAdminOwnerOperation(db);
} finally {
  await db.close();
}
