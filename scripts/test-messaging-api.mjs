import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';

// Actual route code; adapters model database filtering and capture query scope.
// Row-security authorization is covered separately by the PostgreSQL fixture.
const compile=source=>transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText;
const source=(await readFile('app/api/messaging/route.ts','utf8'))
 .replace("import {authClient} from '@/lib/supabase/server';",'const authClient=async()=>globalThis.__gslMessagingApi;')
 .replace("import {allowedOrigin} from '@/lib/auth-policy';","const allowedOrigin=request=>request.headers.get('origin')==='https://example.invalid';")
 .replace("from 'zod'",`from '${import.meta.resolve('zod')}'`);
const {GET,POST}=await import('data:text/javascript;base64,'+Buffer.from(compile(source)).toString('base64'));
const [user,a,b,buyerA,buyerB,ca,cb,product,ra,rb,ta,tb]=Array.from({length:12},()=>randomUUID());
const conversations=[
 {id:ca,buyer_organization_id:buyerA,supplier_organization_id:a,buyer_name:'Buyer A',supplier_name:'Supplier A',product_id:null,product_name:'Contact direct',updated_at:'2026-10-09T10:00:00Z'},
 {id:cb,buyer_organization_id:buyerB,supplier_organization_id:b,buyer_name:'Buyer B',supplier_name:'Supplier B',product_id:null,product_name:'Contact direct',updated_at:'2026-10-09T11:00:00Z'},
];
let traces=[],rpcs=[];
function fixture({bothSides=false,mfa=false,guest=false}={}){
 traces=[];rpcs=[];
 const organizationRows=[{id:a,legal_name:'Supplier A',buyer:false,supplier:true,country_code:'MD'},{id:b,legal_name:'Supplier B',buyer:false,supplier:true,country_code:'GE'},...(bothSides?[{id:buyerA,legal_name:'My purchasing company',buyer:true,supplier:false,country_code:'FR'}]:[])];
 const tables={
  memberships:mfa?[]:organizationRows.map(o=>({organization_id:o.id,user_id:user,role:o.id===buyerA?'procurement':'admin',active:true})),
  organizations:mfa?[]:organizationRows,
  product_conversations:mfa?[]:conversations,
  product_messages:[],
  organization_invitations:[],
  threads:mfa?[]:[{id:ta,rfq_id:ra,supplier_organization_id:a},{id:tb,rfq_id:rb,supplier_organization_id:b}],
  published_products:[{product_id:product,organization_id:a,name:'Synthetic product',description:'Fixture',withdrawn_at:null}],
  published_supplier_profiles:[{organization_id:a,display_name:'Supplier A',withdrawn_at:null,public_details:{research:{kind:'gsl_research',privateMarker:'must-not-leak'},verification:'sourced'}}],
 };
 class Query{
  constructor(table){this.table=table;this.predicates=[];this.columns='*';this.ordering=[];this.from=0;this.to=Infinity}
  select(columns){this.columns=columns;return this}
  eq(key,value){this.predicates.push(row=>row[key]===value);return this}
  in(key,values){this.predicates.push(row=>values.includes(row[key]));return this}
  is(key,value){this.predicates.push(row=>row[key]===value);return this}
  or(expression){traces.push({table:this.table,expression});this.predicates.push(row=>expression.split(',').some(part=>{const [key,operator,value]=part.split('.');assert.equal(operator,'eq');return row[key]===value}));return this}
  order(key,{ascending=true}={}){this.ordering.push({key,ascending});return this}
  range(from,to){this.from=from;this.to=to+1;return this}
  limit(count){this.to=count;return this}
  result(){let rows=tables[this.table].filter(row=>this.predicates.every(test=>test(row))).slice();rows.sort((left,right)=>{for(const {key,ascending} of this.ordering){const value=String(left[key]).localeCompare(String(right[key]));if(value)return ascending?value:-value}return 0});rows=rows.slice(this.from,this.to);return rows.map(row=>this.columns==='*'?{...row}:Object.fromEntries(this.columns.split(',').map(key=>[key,row[key]])))}
  maybeSingle(){return Promise.resolve({data:this.result()[0]||null,error:null})}
  then(resolve,reject){return Promise.resolve({data:this.result(),error:null}).then(resolve,reject)}
 }
 globalThis.__gslMessagingApi={
  auth:{getUser:async()=>({data:{user:guest?null:{id:user,email_confirmed_at:'2026-10-09'}}})},
  from:table=>new Query(table),
  rpc:async(name,args)=>{
   rpcs.push({name,args});
   if(name==='messaging_access')return {data:{mfaRequired:mfa,managedOrganizationIds:mfa?[]:[a,b]},error:null};
   if(name==='messaging_summary')return {data:args.p_ids.map(id=>({id,unread:1,last_body:'Synthetic excerpt',supplier_managed_by_gsl:true})),error:null};
   if(name==='messaging_unread')return {data:2,error:null};
   if(name==='workspace_requests'){
    const requests=mfa?[]:[{id:ra,organization_id:buyerA,title:'RFQ A',state:'sent'},{id:rb,organization_id:buyerB,title:'RFQ B',state:'sent'}].filter(r=>(!args.request_id||r.id===args.request_id)&&(!args.company||r.organization_id===args.company||tables.threads.some(t=>t.rfq_id===r.id&&t.supplier_organization_id===args.company)));
    return {data:{rfqs:requests,threads:tables.threads.filter(t=>requests.some(r=>r.id===t.rfq_id)),items:[],offers:[],page:args.page_number,hasMore:false,total:requests.length},error:null};
   }
   if(name==='send_direct_message')return {data:{conversation:args.p_conversation,message:randomUUID()},error:null};
   throw Error('Unexpected RPC '+name);
  },
 };
}
const request=query=>new Request('https://example.invalid/api/messaging'+(query?'?'+query:''));
fixture();
let response=await GET(request(''));assert.equal(response.status,200);let data=await response.json();
assert.equal(data.conversations.length,2);assert.equal(data.filterOrganization,null);assert.equal(data.organization,null,'No arbitrary sender in a multi-company inbox');assert.ok(!traces.some(trace=>trace.table==='product_conversations'),'Aggregate inbox does not force a first-company filter');
assert.ok(data.organizations.every(o=>o.managed_by_gsl));assert.equal(response.headers.get('cache-control'),'private, no-store');
fixture();response=await GET(request('conversation='+cb));assert.equal(response.status,200);data=await response.json();
assert.equal(data.organization,b,'Deep link to supplier B responds as B, independent of the first company');assert.equal(data.replyOrganizations.length,1);assert.equal(data.selected.supplier_managed_by_gsl,true);
fixture();data=await (await GET(request('organization='+a))).json();assert.deepEqual(data.conversations.map(c=>c.id),[ca]);assert.equal(data.filterOrganization,a);
fixture({bothSides:true});data=await (await GET(request('conversation='+ca))).json();assert.equal(data.replyOrganizations.length,2);assert.equal(data.organization,null,'Ambiguous two-company membership requires explicit sender');
fixture({bothSides:true});data=await (await GET(request('conversation='+ca+'&replyOrganization='+buyerA))).json();assert.equal(data.organization,buyerA);
fixture();assert.equal((await GET(request('conversation='+cb+'&replyOrganization='+a))).status,403,'Sender must belong to the selected conversation');
fixture({mfa:true});response=await GET(request('conversation='+ca));assert.equal(response.status,403);assert.equal((await response.json()).error,'MFA_REQUIRED');
fixture({guest:true});response=await GET(request('product='+product));assert.equal(response.status,401);data=await response.json();assert.equal(data.product.supplier_managed_by_gsl,true);assert.ok(!JSON.stringify(data).includes('must-not-leak'));
fixture();data=await (await GET(request('supplier='+a))).json();assert.equal(data.supplier.supplier_managed_by_gsl,true);assert.ok(!('public_details' in data.supplier));
fixture({bothSides:true});data=await (await GET(request('supplier='+a))).json();assert.equal(data.organization,null,'Starting a conversation also requires an explicit sender when several companies are eligible');
fixture();assert.equal((await GET(request('organization=invalid'))).status,400);assert.equal((await GET(request('page=-1'))).status,400);
fixture();data=await (await GET(request('unread=1'))).json();assert.equal(data.unread,2);assert.deepEqual(rpcs.map(rpc=>rpc.name),['messaging_unread']);
fixture();
const command={organization:b,product:null,supplier:null,conversation:cb,body:'Synthetic reply',command:randomUUID()};
const post=origin=>new Request('https://example.invalid/api/messaging',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(command)});
assert.equal((await POST(post('https://evil.invalid'))).status,403);assert.equal(rpcs.length,0);
assert.equal((await POST(post('https://example.invalid'))).status,200);assert.equal(rpcs[0].args.p_company,b);assert.equal(rpcs[0].args.p_conversation,cb);
delete globalThis.__gslMessagingApi;
console.log('Messaging API: aggregate default, optional company filter, deep-link sender, explicit two-sided identity, MFA gate, public provenance allowlist, origin validation, unchanged command identity. No hosted services.');

const platformSource=(await readFile('app/api/platform/route.ts','utf8'))
 .replace("import {authClient} from '@/lib/supabase/server';",'const authClient=async()=>globalThis.__gslMessagingApi;')
 .replace("import {allowedOrigin} from '@/lib/auth-policy';","const allowedOrigin=request=>request.headers.get('origin')==='https://example.invalid';")
 .replace("import {searchSchema} from '@/lib/search-criteria';",'const searchSchema={safeParse:()=>({success:false})};')
 .replace("from 'zod'",`from '${import.meta.resolve('zod')}'`);
const platform=await import('data:text/javascript;base64,'+Buffer.from(compile(platformSource)).toString('base64'));
const platformRequest=query=>new Request('https://example.invalid/api/platform?view=workspace'+(query?'&'+query:''));
fixture();response=await platform.GET(platformRequest(''));assert.equal(response.status,200);data=await response.json();assert.equal(data.rfqs.length,2);assert.equal(rpcs.find(rpc=>rpc.name==='workspace_requests').args.company,null,'RFQ API requests aggregate scope when no company was selected');
fixture();response=await platform.GET(platformRequest('thread='+tb));assert.equal(response.status,200);data=await response.json();assert.equal(data.rfqs[0].id,rb);assert.equal(rpcs.find(rpc=>rpc.name==='workspace_requests').args.request_id,rb,'Thread email link resolves the exact RFQ under RLS');
fixture();data=await (await platform.GET(platformRequest('organization='+a+'&request='+ra))).json();assert.equal(data.rfqs.length,1);assert.equal(data.rfqs[0].id,ra);assert.equal(rpcs.find(rpc=>rpc.name==='workspace_requests').args.company,a);
fixture();assert.equal((await platform.GET(platformRequest('organization='+b+'&request='+ra))).status,403,'Wrong responding company cannot select the focused RFQ');
fixture();assert.equal((await platform.GET(platformRequest('thread='+randomUUID()))).status,403);assert.ok(!rpcs.some(rpc=>rpc.name==='workspace_requests'),'Unauthorized thread never reaches a focused workspace query');
fixture({mfa:true});response=await platform.GET(platformRequest('thread='+ta));assert.equal(response.status,403);assert.equal((await response.json()).error,'MFA_REQUIRED');
fixture();assert.equal((await platform.GET(platformRequest('thread='+ta+'&request='+ra))).status,400);assert.equal((await platform.GET(platformRequest('request=invalid'))).status,400);
fixture({guest:true});assert.equal((await platform.GET(platformRequest(''))).status,401);assert.equal(rpcs.length,0);
delete globalThis.__gslMessagingApi;
console.log('RFQ API: aggregate scope, exact thread/request links, explicit company identity, wrong-company refusal, RLS lookup boundary and MFA gate passed.');
