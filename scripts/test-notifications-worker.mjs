import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';

// Actual application code; SMTP, Auth transport and queue RPC are replaced at
// their boundaries. No external connection or production configuration is used.
if(process.env.DATABASE_URL||process.env.SUPABASE_URL)throw Error('External configuration refused for fixtures');
const compile=source=>transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText;
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const runtimeUrl=url(compile(await readFile('lib/runtime-config.ts','utf8')));
const brandUrl=url(compile(await readFile('lib/brand.ts','utf8')));
const templateUrl=url(compile(await readFile('lib/notifications/templates.ts','utf8')).replace("'../brand'",JSON.stringify(brandUrl)));
const {notificationTemplate}=await import(templateUrl);
const id=randomUUID(),reference=randomUUID();
for(const language of ['fr','en']){
 const template=notificationTemplate('direct_message',language,'https://example.invalid',reference);
 assert.ok(template.text.includes('https://example.invalid/messagerie?conversation='+reference+'&lang='+language));
 assert.ok(!template.text.includes('/operations'));
}
assert.throws(()=>notificationTemplate('toString','fr','https://example.invalid',reference),/UNKNOWN_EMAIL_TEMPLATE/);
assert.ok(notificationTemplate('contact_operator','fr','https://example.invalid',reference).text.includes('next=%2Fadministration'));
for(const template of ['new_rfq','new_message','new_offer','offer_selected'])assert.ok(notificationTemplate(template,'fr','https://example.invalid',reference).text.includes('/operations?thread='+reference));
assert.ok(notificationTemplate('rfq_cancelled','fr','https://example.invalid',reference).text.includes('/operations?request='+reference));
const smtpUrl=url('export default {createTransport:options=>{globalThis.__gslMailFixture.transportOptions=options;globalThis.__gslMailFixture.transports++;return {sendMail:async message=>{globalThis.__gslMailFixture.sent.push(message);return globalThis.__gslMailFixture.deliver(message)},close:()=>{globalThis.__gslMailFixture.closed++}}}};');
const clientUrl=url('export const createClient=(address,key,options)=>{globalThis.__gslMailFixture.clients++;globalThis.__gslMailFixture.clientOptions=options;return {rpc:async(name,args)=>{globalThis.__gslMailFixture.calls.push({name,args});return globalThis.__gslMailFixture.rpc(name,args)}}};');
const workerCode=compile(await readFile('lib/notifications/worker.ts','utf8'))
 .replace("'nodemailer'",JSON.stringify(smtpUrl)).replace("'@supabase/supabase-js'",JSON.stringify(clientUrl))
 .replace("'@/lib/runtime-config'",JSON.stringify(runtimeUrl)).replace("'./templates'",JSON.stringify(templateUrl));
const workerUrl=url(workerCode),worker=await import(workerUrl);
const job={id,attempts:1,email:'synthetic-owner@example.invalid',template:'direct_message',language:'fr',resource_id:reference};
const fixture=(overrides={})=>globalThis.__gslMailFixture={clients:0,transports:0,closed:0,calls:[],sent:[],deliver:async message=>({accepted:[message.to],messageId:message.messageId}),rpc:async name=>({data:name==='claim_notifications'?[job]:null,error:null}),...overrides};
const environment={SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_not_real',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture_not_real_never_sent',GSL_ENVIRONMENT:'test',GSL_SITE_URL:'https://example.invalid',GSL_WORKER_SECRET:'fixture-worker-secret-not-real',GSL_SMTP_HOST:'smtp.example.invalid',GSL_SMTP_USER:'fixture',GSL_SMTP_PASSWORD:'fixture-smtp-password-not-real',GSL_EMAIL_FROM:'notification@example.invalid'};
assert.equal(worker.notificationConfigStatus({}).ready,false);
assert.equal(worker.notificationConfigStatus(environment).status,'disabled');
const ready={...environment,GSL_TRANSACTIONAL_EMAIL_ENABLED:'true'};
assert.equal(worker.notificationConfigStatus(ready).ready,true);
assert.equal(worker.notificationConfigStatus({...ready,SUPABASE_SERVICE_ROLE_KEY:ready.SUPABASE_PUBLISHABLE_KEY}).ready,false);
assert.equal(worker.notificationConfigStatus({...ready,GSL_SMTP_PORT:'NaN'}).ready,false);
assert.equal(worker.notificationConfigStatus({...ready,GSL_EMAIL_FROM:'owner@example.invalid\r\nBcc:extra@example.invalid'}).ready,false);
assert.equal(worker.notificationConfigStatus({...ready,GSL_SMTP_PASSWORD:''}).ready,false);
const safeStatus=JSON.stringify(worker.notificationConfigStatus(ready));
for(const secret of ['SUPABASE_SERVICE_ROLE_KEY','GSL_WORKER_SECRET','GSL_SMTP_PASSWORD'].map(name=>ready[name]))assert.ok(!safeStatus.includes(secret));
Object.assign(process.env,environment,{GSL_TRANSACTIONAL_EMAIL_ENABLED:'false'});
let current=fixture();await assert.rejects(worker.processNotifications(),/NOTIFICATIONS_NOT_CONFIGURED/);assert.equal(current.clients,0);assert.equal(current.transports,0);assert.equal(current.calls.length,0);
process.env.GSL_TRANSACTIONAL_EMAIL_ENABLED='true';
current=fixture();assert.deepEqual(await worker.processNotifications(),{processed:1,accepted:1,acknowledged:1,failed:0,retryScheduled:0,uncertain:0});
assert.equal(current.closed,1);assert.equal(current.transportOptions.requireTLS,true);assert.equal(current.transportOptions.secure,true);
assert.equal(current.sent[0].messageId,'<'+id+'@example.invalid>');assert.ok(current.sent[0].text.includes('/messagerie?conversation='+reference));
assert.equal(current.calls.filter(call=>call.name==='finish_notification'&&call.args.outcome==='accepted').length,1);
current=fixture({deliver:async()=>{throw {code:'EDNS',command:'CONN'}}});
assert.deepEqual(await worker.processNotifications(),{processed:1,accepted:0,acknowledged:0,failed:0,retryScheduled:1,uncertain:0});
assert.equal(current.calls.at(-1).args.outcome,'retry');assert.equal(current.closed,1);
current=fixture({deliver:async()=>{throw {code:'EDNS',command:'CONN'}},rpc:async name=>({data:name==='claim_notifications'?[{...job,attempts:5}]:null,error:null})});
assert.deepEqual(await worker.processNotifications(),{processed:1,accepted:0,acknowledged:0,failed:1,retryScheduled:0,uncertain:0});
assert.equal(current.calls.at(-1).args.outcome,'failed','Exhausted retry budget is reported as a final failure');
current=fixture({deliver:async()=>{throw {code:'ETIMEDOUT',command:'DATA'}}});
assert.deepEqual(await worker.processNotifications(),{processed:1,accepted:0,acknowledged:0,failed:1,retryScheduled:0,uncertain:1});
assert.equal(current.calls.at(-1).args.failure_code,'DELIVERY_UNCERTAIN');
current=fixture({rpc:async name=>name==='claim_notifications'?{data:[job],error:null}:{data:null,error:{message:'Simulated lost acknowledgement'}}});
assert.deepEqual(await worker.processNotifications(),{processed:1,accepted:1,acknowledged:0,failed:0,retryScheduled:0,uncertain:1});
assert.equal(current.calls.filter(call=>call.name==='finish_notification').length,1,'Lost acknowledgement never triggers a second send or a blind retry');
current=fixture({rpc:async name=>({data:name==='claim_notifications'?[{...job,template:'toString'}]:null,error:null})});
assert.deepEqual(await worker.processNotifications(),{processed:1,accepted:0,acknowledged:0,failed:1,retryScheduled:0,uncertain:0});assert.equal(current.sent.length,0);
current=fixture({rpc:async()=>({data:null,error:{message:'Simulated queue failure'}})});
await assert.rejects(worker.processNotifications(),/QUEUE_UNAVAILABLE/);assert.equal(current.closed,1);
const routeCode=compile(await readFile('app/api/internal/notifications/route.ts','utf8'))
 .replace("'@/lib/notifications/worker'",JSON.stringify(workerUrl)).replace("'@/lib/notifications/templates'",JSON.stringify(templateUrl));
const route=await import(url(routeCode));
const request=authorized=>new Request('https://example.invalid/api/internal/notifications',{headers:authorized?{authorization:'Bearer '+environment.GSL_WORKER_SECRET}:{}});
current=fixture();assert.equal((await route.GET(request(false))).status,403);assert.equal((await route.POST(request(false))).status,403);
const status=await route.GET(request(true));assert.equal(status.status,200);assert.equal((await status.json()).deliveryAttempted,false);assert.equal(current.calls.length,0);
process.env.GSL_TRANSACTIONAL_EMAIL_ENABLED='false';assert.equal((await route.POST(request(true))).status,503);assert.equal(current.calls.length,0,'Disabled worker never leases queued notifications');
delete globalThis.__gslMailFixture;
console.log('Notification worker: redacted config, disabled-before-claim, private status, direct conversation links, TLS, stable IDs, safe pre-DATA retry, uncertain SMTP/ack handling, invalid-template rejection. No real SMTP or hosted RPC.');

const cronCode=compile(await readFile('app/api/internal/notifications/cron/route.ts','utf8')).replace("'@/lib/notifications/worker'",JSON.stringify(workerUrl));
const cron=await import(url(cronCode));
process.env.CRON_SECRET='fixture-cron-secret-not-real';
const cronRequest=secret=>new Request('https://example.invalid/api/internal/notifications/cron',{headers:{authorization:'Bearer '+secret,'user-agent':'vercel-cron/1.0'}});
current=fixture();assert.equal((await cron.GET(cronRequest(environment.GSL_WORKER_SECRET))).status,403,'Manual worker credential does not authorize the cron route');
assert.equal((await cron.GET(new Request('https://example.invalid/api/internal/notifications/cron',{headers:{'user-agent':'vercel-cron/1.0'}}))).status,403,'User-Agent is never authentication');
assert.equal((await cron.GET(cronRequest(process.env.CRON_SECRET))).status,503);assert.equal(current.calls.length,0,'Disabled cron does not lease notifications');
assert.equal(cron.HEAD().status,405);assert.equal(current.calls.length,0);
process.env.GSL_TRANSACTIONAL_EMAIL_ENABLED='true';delete process.env.GSL_WORKER_SECRET;
assert.equal(worker.notificationConfigStatus().ready,true,'Cron authorization can enable the worker independently of manual authorization');
current=fixture({rpc:async()=>({data:[],error:null})});const response=await cron.GET(cronRequest(process.env.CRON_SECRET));assert.equal(response.status,200);assert.equal((await response.json()).processed,0);assert.equal(current.sent.length,0);assert.equal(current.closed,1);
delete globalThis.__gslMailFixture;
console.log('Cron adapter: distinct bearer authorization, no User-Agent trust, disabled-before-claim, safe HEAD, cron-only setup and empty mocked queue passed.');
