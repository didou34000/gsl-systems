import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const modules=new Map();
async function compile(filename){
 if(modules.has(filename))return modules.get(filename);
 let code=ts.transpileModule(await readFile(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)]){
  const name=match[1],url=name.startsWith('.')?await compile(path.join(path.dirname(filename),name)+'.ts'):import.meta.resolve(name);
  code=code.replaceAll(match[0],`from ${JSON.stringify(url)}`);
 }
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');modules.set(filename,url);return url;
}
const {supplierProgress}=await import(await compile('lib/onboarding/supplier-progress.ts'));
const {emptyProfile,productSchema,companyIssues,productPublicationIssues}=await import(await compile('lib/onboarding/supplier-profile.ts'));
const profile=emptyProfile();
assert.equal(supplierProgress(profile,'company'),0,'empty optional sections must not give a blank company 50%');
const previous=[];
for(const update of [()=>profile.legalName='Synthetic company',()=>profile.country='TR',()=>profile.headquarters.city='Bursa',()=>profile.activity='manufacturer',()=>profile.description='Precision parts manufacturing for industrial robotic assemblies.',()=>profile.contact.name='Synthetic contact',()=>profile.contact.email='test@example.invalid',()=>profile.attestation=true]){
 previous.push(supplierProgress(profile,'company'));update();assert.ok(supplierProgress(profile,'company')>previous.at(-1),'each valid required field increases progress');
}
assert.equal(supplierProgress(profile,'company'),100);assert.deepEqual(companyIssues(profile),[]);
assert.equal(profile.sites.length+profile.certificates.length,0,'optional evidence is not required for completion');
const complete=structuredClone(profile);profile.contact.email='invalid';assert.ok(supplierProgress(profile,'company')<100);profile.contact.email=complete.contact.email;
profile.description='short';assert.ok(supplierProgress(profile,'company')<100);Object.assign(profile,structuredClone(complete));
profile.country='US';assert.ok(supplierProgress(profile,'company')<100);Object.assign(profile,structuredClone(complete));
profile.attestation=false;assert.ok(supplierProgress(profile,'company')<100);profile.attestation=true;
assert.equal(supplierProgress(profile,'products'),0,'no product is not a completed product catalogue');
profile.products=[productSchema.parse({id:'a113fc3d-2afb-4396-86fb-cda623d93b61',name:'Precision part',family:'pieces-mecaniques',category:'metal',description:'A precision mechanical component for industrial robotic assemblies.',origin:'TR',moq:'1',unit:'pcs',specs:{}})];
// Pick a complete real family/type from the schema used by the product editor.
const {productFamilies,KIND_KEY,isRequired,specFields}=await import(await compile('lib/products/spec-fields.ts'));
const family=productFamilies.find(f=>f.id==='actionnement-transmission');assert.ok(family);
const kind=family.fields.find(f=>f.key===KIND_KEY)?.options?.[0]?.value||'';
const product=profile.products[0];product.family=family.id;product.specs={...(kind?{[KIND_KEY]:kind}:{})};
for(const field of specFields(family.id,kind).filter(f=>isRequired(f,kind)))product.specs[field.key]=field.type==='select'?field.options[0].value:field.type==='number'?'10':'Synthetic value';
assert.deepEqual(productPublicationIssues(profile),[]);assert.equal(supplierProgress(profile,'products'),100);
const required=specFields(family.id,kind).find(f=>f.type==='number'&&isRequired(f,kind));assert.ok(required);
product.specs[required.key]='invalid';assert.ok(supplierProgress(profile,'products')<100,'invalid required technical data cannot complete the bar');product.specs[required.key]='10';
product.moq='0';assert.ok(supplierProgress(profile,'products')<100);product.moq='1';
product.description='short';assert.ok(supplierProgress(profile,'products')<100);product.description='A precision mechanical component for industrial robotic assemblies.';
product.listingStatus='draft';assert.equal(supplierProgress(profile,'products'),0);product.listingStatus='publish';
const restored=JSON.parse(JSON.stringify(profile));assert.equal(supplierProgress(restored,'products'),100,'restored saved profiles keep their real progress');
console.log('Supplier progress: empty forms start at 0; every required company field updates progress; invalid data regresses; optional sections do not block 100; empty/draft products stay at 0; technical requirements and saved profiles are respected.');
