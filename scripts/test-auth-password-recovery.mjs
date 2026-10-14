import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Password change after a recovery code, with Supabase Auth mocked at the client boundary.
// Regression: accounts with an authenticator got "service unavailable" because Supabase
// refuses password updates on aal1 sessions (insufficient_aal).
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compile=async path=>ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const modules={'@/lib/supabase/server':dataUrl('export const authClient=async()=>globalThis.__gslRecoveryFixture;')};
for(const [name,path] of [['@/lib/auth-policy','lib/auth-policy.ts'],['@/lib/i18n/languages','lib/i18n/languages.ts'],['@/lib/onboarding/iso-countries','lib/onboarding/iso-countries.ts'],['@/lib/sourcing-coverage','lib/sourcing-coverage.ts']])modules[name]=dataUrl(await compile(path));
let source=await compile('app/api/auth/route.ts');
for(const [name,url] of Object.entries(modules))source=source.replace(`'${name}'`,JSON.stringify(url));
const route=await import(dataUrl(source));

function fixture({mfa,validCode='123456'}){
 const state={level:'aal1',updated:null,verified:0};
 globalThis.__gslRecoveryFixture={auth:{
  getUser:async()=>({data:{user:{id:'u',email_confirmed_at:'2026-10-14'}}}),
  mfa:{
   getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:state.level,nextLevel:mfa?'aal2':'aal1'},error:null}),
   listFactors:async()=>({data:{totp:mfa?[{id:'f1',status:'verified'}]:[]},error:null}),
   challengeAndVerify:async({factorId,code})=>{state.verified++;if(factorId==='f1'&&code===validCode){state.level='aal2';return {data:{},error:null}}return {data:null,error:{status:422,code:'mfa_verification_failed'}}},
  },
  updateUser:async args=>{if(mfa&&state.level!=='aal2')return {error:{status:401,code:'insufficient_aal'}};state.updated=args;return {error:null}},
 }};
 return state;
}
const post=body=>route.POST(new Request('https://www.gsl-systems.com/api/auth',{method:'POST',headers:{origin:'https://www.gsl-systems.com','Content-Type':'application/json'},body:JSON.stringify({action:'password',password:'a-new-long-passphrase',...body})}));

// Without an authenticator: unchanged behaviour.
let state=fixture({mfa:false});
assert.equal((await post({})).status,200);assert.deepEqual(state.updated,{password:'a-new-long-passphrase'});

// With an authenticator: the code is asked for, never a generic outage.
state=fixture({mfa:true});
let r=await post({});assert.equal(r.status,403);assert.equal((await r.json()).error,'MFA_REQUIRED');assert.equal(state.updated,null);
r=await post({mfaCode:'000000'});assert.equal(r.status,400);assert.equal((await r.json()).error,'MFA_CODE');assert.equal(state.updated,null);
r=await post({mfaCode:'12345'});assert.equal((await r.json()).error,'MFA_REQUIRED');
r=await post({mfaCode:'123456'});assert.equal(r.status,200);assert.deepEqual(state.updated,{password:'a-new-long-passphrase'});

// Sign-up keeps the company details and refuses a supplier country outside the sourcing scope.
let signed=null;
globalThis.__gslRecoveryFixture={auth:{signUp:async args=>{signed=args;return {error:null}}}};
const signup=body=>route.POST(new Request('https://www.gsl-systems.com/api/auth',{method:'POST',headers:{origin:'https://www.gsl-systems.com','Content-Type':'application/json'},body:JSON.stringify({action:'signup',email:'a@example.invalid',password:'a-new-long-passphrase',name:'Atelier Exemple',language:'fr',next:'/compte',...body})}));
assert.equal((await signup({})).status,400);
assert.equal((await signup({country:'FR',purpose:'supplier'})).status,400);
assert.equal((await signup({country:'TR',purpose:'supplier',legalForm:'limited şirket (Ltd. Şti.)'})).status,200);
assert.deepEqual([signed.options.data.company_name,signed.options.data.company_country,signed.options.data.company_legal_form],['Atelier Exemple','TR','limited şirket (Ltd. Şti.)']);
assert.equal((await signup({country:'FR',purpose:'buyer'})).status,200);

console.log('Password recovery passed: authenticator code required on aal1 sessions, wrong codes refused, password unchanged until verified; sign-up company fields validated.');
