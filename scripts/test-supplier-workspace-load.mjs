import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

// Execute the real GET with controlled Auth/RPC adapters, including the missing-migration case.
const encoded=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compiled=new Map();
async function moduleUrl(filename){
 if(compiled.has(filename))return compiled.get(filename);
 let source=await readFile(filename,'utf8');
 if(filename==='app/api/supplier-profile/route.ts')source=source.replace("import {authClient} from '@/lib/supabase/server';",'const authClient=async()=>globalThis.__supplierLoadClient;');
 let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)]){
  const name=match[1];let url;
  if(name.startsWith('@/'))url=await moduleUrl(name.slice(2)+'.ts');
  else if(name.startsWith('.'))url=await moduleUrl(path.join(path.dirname(filename),name)+'.ts');
  else url=import.meta.resolve(name);
  code=code.replaceAll(match[0],`from ${JSON.stringify(url)}`);
 }
 const url=encoded(code);compiled.set(filename,url);return url;
}
const {GET}=await import(await moduleUrl('app/api/supplier-profile/route.ts'));
const owner='a113fc3d-2afb-4396-86fb-cda623d93b61';
const state={user:{id:owner,email:'test@example.invalid',email_confirmed_at:'yes'},authError:null,reviewError:null,applicationError:null,filters:[],rpcCalls:0};
const application={revision:7,status:'draft',organization_id:null,payload:{legalName:'Preserved company draft',products:[]}};
globalThis.__supplierLoadClient={auth:{getUser:async()=>({data:{user:state.user},error:state.authError})},from(table){const q={select(){return q},eq(k,v){state.filters.push([table,k,v]);return q},order(){return q},limit(){return q},in(){return q},maybeSingle(){return q},then(resolve,reject){return Promise.resolve({data:table==='supplier_applications'?application:[],error:table==='supplier_applications'?state.applicationError:null}).then(resolve,reject)}};return q},rpc:async()=>{state.rpcCalls++;return {data:[],error:state.reviewError}},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://example.invalid/image'}})})}};
for(const code of ['PGRST202','42883']){
 state.reviewError={code,message:'Product review RPC unavailable'};const response=await GET();assert.equal(response.status,200);const data=await response.json();assert.equal(data.application.revision,7);assert.equal(data.application.payload.legalName,application.payload.legalName);assert.equal(data.email,state.user.email);assert.equal(data.productReviewsAvailable,false);assert.deepEqual(data.productReviews,[]);assert.equal(response.headers.get('cache-control'),'private, no-store');
}
assert.ok(state.filters.some(([table,key,value])=>table==='supplier_applications'&&key==='owner_id'&&value===owner));
state.reviewError=null;assert.equal((await (await GET()).json()).productReviewsAvailable,true);
state.reviewError={code:'42501',message:'Permission denied'};assert.equal((await GET()).status,503,'permission errors are not treated as a missing migration');state.reviewError=null;
state.applicationError={code:'08006',message:'Database unavailable'};assert.equal((await GET()).status,503);state.applicationError=null;
state.authError={name:'AuthRetryableFetchError',status:503};state.user=null;assert.equal((await GET()).status,503,'temporary Auth failure is not a logout');
state.authError={name:'AuthSessionMissingError'};const before=state.rpcCalls;assert.equal((await GET()).status,401);assert.equal(state.rpcCalls,before,'anonymous requests never read product reviews');
state.authError=null;assert.equal((await GET()).status,401);
console.log('Supplier workspace loading: authenticated draft survives missing review migration; owner filters and no-store preserved; database/permission/Auth outages remain 503; only absent session returns 401 (mocked transport).');
