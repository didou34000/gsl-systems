// Direct product and manufacturer pages must survive a database without the component_* views
// (migrations 20261012120000 and 20261013130000 not applied): they fall back to the published tables.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const source=compile('lib/supabase/public-catalogue.ts')
 .replace("'zod'",JSON.stringify(import.meta.resolve('zod')))
 .replace("'@supabase/supabase-js'",JSON.stringify(dataUrl('export function createClient(){throw Error("no network in tests")}')))
 .replace("'@/lib/runtime-config'",JSON.stringify(dataUrl('export function runtimeConfig(){throw Error("no configuration in tests")}')));
const catalogue=await import(dataUrl(source));

/** Minimal PostgREST stand-in: each relation is either a list of rows or an error. */
function mockDb(relations){
 const calls=[];
 return {calls,from(table){
  const filters=[];let single=false;
  const run=()=>{calls.push(table);const relation=relations[table];if(!relation)return {data:null,error:{code:'PGRST205',message:`Could not find the table 'public.${table}' in the schema cache`}};if(relation.error)return {data:null,error:relation.error};const rows=relation.filter(row=>filters.every(f=>f(row)));return single?{data:rows[0]??null,error:null}:{data:rows,error:null};};
  const query={select:()=>query,eq:(k,v)=>(filters.push(r=>r[k]===v),query),neq:(k,v)=>(filters.push(r=>r[k]!==v),query),is:(k,v)=>(filters.push(r=>(r[k]??null)===v),query),contains:()=>query,limit:()=>query,order:()=>query,
   maybeSingle:()=>{single=true;return Promise.resolve(run())},then:(resolve,reject)=>Promise.resolve(run()).then(resolve,reject)};
  return query;
 }};
}
const org='5b0e3a52-5c1f-4c39-9a51-1d7a3c1e0001',product='5b0e3a52-5c1f-4c39-9a51-1d7a3c1e0002',other='5b0e3a52-5c1f-4c39-9a51-1d7a3c1e0003',missingId='5b0e3a52-5c1f-4c39-9a51-1d7a3c1e0009';
const published={product_id:product,organization_id:org,name:'hodi',description:'Pièce publiée par son fabricant.',category:'metal',specifications:{verification:'unverified',compliance:'not_assessed'},published_at:'2026-10-10T00:00:00Z',withdrawn_at:null};
const withdrawn={...published,product_id:other,name:'retirée',withdrawn_at:'2026-10-11T00:00:00Z'};
const profile={organization_id:org,display_name:'Hodi Makina',country_code:'TR',city:'Bursa',description:'',processes:[],materials:[],published_at:'2026-10-10T00:00:00Z',public_details:{verification:'unverified'},withdrawn_at:null};

// Production today: only the published tables exist.
const prod=mockDb({published_products:[published,withdrawn],published_supplier_profiles:[profile],published_media:[]});
const page=await catalogue.productProfile(product,prod);
assert.equal(page.name,'hodi');assert.equal(page.catalogue_status,'not_admitted');
assert.deepEqual(prod.calls,['component_products','published_products']);
assert.equal(await catalogue.productProfile(other,prod),null,'a withdrawn product stays hidden');
assert.equal(await catalogue.productProfile(missingId,prod),null);
assert.equal(await catalogue.productProfile('not-a-uuid',prod),null);
const maker=await catalogue.supplierProfile(org,prod);
assert.equal(maker.display_name,'Hodi Makina');assert.equal(maker.catalogue_status,'not_admitted');
const offers=await catalogue.supplierProducts(org,prod);
assert.deepEqual(offers.map(x=>[x.name,x.catalogue_status]),[['hodi','not_admitted']]);
assert.deepEqual(await catalogue.similarProducts(page,prod),[],'similar offers only come from the reviewed catalogue');
assert.deepEqual(await catalogue.makerLocations(prod),{available:false,makers:[]});
assert.deepEqual(await catalogue.supplierMedia(org,mockDb({})),[]);

// Postgres-level "undefined table" is treated the same way.
const undefinedTable=mockDb({component_products:{error:{code:'42P01'}},published_products:[published]});
assert.equal((await catalogue.productProfile(product,undefinedTable)).catalogue_status,'not_admitted');

// With the views: an admitted product comes from the reviewed catalogue.
const admittedRow={...published,category:'pieces-mecaniques',specifications:{...published.specifications,qualification:'explicit'}};
const full=mockDb({component_products:[admittedRow],component_supplier_profiles:[profile],published_products:[published],published_supplier_profiles:[profile]});
const admitted=await catalogue.productProfile(product,full);
assert.equal(admitted.catalogue_status,'admitted');assert.equal(admitted.category,'pieces-mecaniques');
assert.deepEqual(full.calls,['component_products']);
assert.equal((await catalogue.supplierProfile(org,full)).catalogue_status,'admitted');
assert.deepEqual((await catalogue.makerLocations(full)).makers.map(m=>m.display_name),['Hodi Makina']);
assert.deepEqual(await catalogue.similarProducts(admitted,full),[]);

// Any other failure is still reported, not hidden as an empty page.
const broken=mockDb({component_products:{error:{code:'57014',message:'statement timeout'}},published_products:[published]});
await assert.rejects(catalogue.productProfile(product,broken),/CATALOGUE_UNAVAILABLE/);
const brokenFallback=mockDb({published_products:{error:{code:'57014'}}});
await assert.rejects(catalogue.productProfile(product,brokenFallback),/CATALOGUE_UNAVAILABLE/);
await assert.rejects(catalogue.similarProducts(page,broken),/CATALOGUE_UNAVAILABLE/);

// Map placement reuses the Europe map projection.
const maps=compile('lib/maps/maker-cities.ts').replace("'./europe.json'",JSON.stringify(dataUrl('export default '+fs.readFileSync('lib/maps/europe.json','utf8'))));
const {projectToEuropeMap,makerPoint,cityKey}=await import(dataUrl(maps));
const europe=JSON.parse(fs.readFileSync('lib/maps/europe.json','utf8'));
const centre=code=>europe.countries.find(c=>c.code===code).center;
for(const [code,lonlat] of [['MA',[-6.2,32.2]],['EG',[30.5,27]],['GB',[-1.8,52.8]],['TR',[33,39.2]]]){const [x,y]=projectToEuropeMap(...lonlat);assert.ok(Math.abs(x-centre(code)[0])<0.3&&Math.abs(y-centre(code)[1])<0.3,code+' anchor');}
assert.equal(cityKey('Kapaklı (Tekirdağ)'),'kapakli');
assert.equal(makerPoint('TR','Kapaklı (Tekirdağ)').precision,'city');
assert.deepEqual(makerPoint('MK','Unknown village'),{x:centre('MK')[0],y:centre('MK')[1],precision:'country'});
assert.equal(makerPoint('ZZ','Paris'),null);
console.log('public catalogue fallback and map placement: ok');
