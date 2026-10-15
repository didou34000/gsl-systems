// Address search proxy (mocked geocoder, no network), buyer defaults and the specification PDF of "Décrire mon besoin".
// Usage: node scripts/test-requirement-extras.mjs [output.pdf]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {register} from 'node:module';
import {pathToFileURL} from 'node:url';

const root=pathToFileURL(process.cwd()+'/').href;
// Resolves "@/…" and extensionless TypeScript imports, transpiles .ts/.tsx on the fly.
register('data:text/javascript,'+encodeURIComponent(`
import fs from 'node:fs';import {fileURLToPath} from 'node:url';import ts from ${JSON.stringify(root+'node_modules/typescript/lib/typescript.js')};
const root=${JSON.stringify(root)};
export async function resolve(spec,ctx,next){
 let s=spec.startsWith('@/')?new URL(spec.slice(2),root).href:spec;
 if((s.startsWith('.')||s.startsWith('file:'))&&ctx.parentURL?.startsWith('file:')){const base=new URL(s,ctx.parentURL);for(const ext of ['','.ts','.tsx','/index.ts']){const u=new URL(base.href+ext);if(fs.existsSync(fileURLToPath(u))&&fs.statSync(fileURLToPath(u)).isFile())return {url:u.href,shortCircuit:true,format:u.pathname.endsWith('.json')?'json':undefined};}}
 return next(s,ctx);
}
export async function load(url,ctx,next){
 if(url.endsWith('.ts')||url.endsWith('.tsx')){const src=fs.readFileSync(fileURLToPath(url),'utf8');return {format:'module',shortCircuit:true,source:ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText};}
 if(url.endsWith('.json'))return {...(await next(url,{...ctx,importAttributes:{type:'json'}})),shortCircuit:true};
 return next(url,ctx);
}`));

// ---------- Address search (lib/geocode.ts + app/api/geocode/route.ts) with a mocked Photon ----------
const geo=await import('../lib/geocode.ts');
assert.equal(geo.cleanQuery('  ab '),null);assert.equal(geo.cleanQuery('12 rue'),'12 rue');assert.equal(geo.cleanQuery('x'.repeat(201)),null);assert.equal(geo.cleanQuery('<script>'),null);assert.equal(geo.cleanQuery(42),null);
assert.equal(geo.photonLanguage('fr'),'fr');assert.equal(geo.photonLanguage('zh'),'default');assert.equal(geo.cleanCountry('fr'),'');assert.equal(geo.cleanCountry('DE'),'DE');
const photon={features:[
 {properties:{osm_type:'N',osm_id:1,osm_key:'place',osm_value:'house',type:'house',housenumber:'10',street:'Unter den Linden',postcode:'10117',city:'Berlin',state:'Berlin',country:'Deutschland',countrycode:'DE'}},
 {properties:{osm_type:'N',osm_id:2,osm_key:'building',type:'house',housenumber:'12',street:'Rue de Rivoli',postcode:'75001',city:'Paris',state:'Île-de-France',country:'France',countrycode:'FR'}},
 {properties:{osm_type:'W',osm_id:3,osm_key:'highway',type:'street',name:'Calle de Alcalá',postcode:'28014',city:'Madrid',country:'España',countrycode:'ES'}},
 {properties:{osm_type:'R',osm_id:4,osm_key:'place',type:'city',name:'Yokohama',state:'Kanagawa',country:'日本',countrycode:'JP'}},
 {properties:{osm_type:'N',osm_id:5,osm_key:'amenity',type:'house',name:'Usine Nord',street:'Rue Principale',housenumber:'5',postcode:'59000',city:'Lille',country:'France',countrycode:'FR'}},
 {properties:{}},'junk',
]};
const calls=[];
globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});if(String(url).includes('fail'))throw new Error('network');if(String(url).includes('q=500'))return {ok:false,status:500,json:async()=>({})};return {ok:true,status:200,json:async()=>structuredClone(photon)}};
const direct=await geo.searchAddresses('rue de rivoli',{language:'fr',country:'FR',limit:5});
assert.equal(direct.length,5);assert.equal(direct[0].countryCode,'FR','Chosen country first');
const rivoli=direct.find(s=>s.city==='Paris');assert.equal(rivoli.line,'12 Rue de Rivoli');assert.equal(rivoli.postalCode,'75001');
const berlin=direct.find(s=>s.city==='Berlin');assert.equal(berlin.line,'Unter den Linden 10','German order: street then number');
assert.equal(direct.find(s=>s.city==='Madrid').line,'Calle de Alcalá');
const yokohama=direct.find(s=>s.countryCode==='JP');assert.equal(yokohama.line,'');assert.equal(yokohama.city,'Yokohama');assert.ok(yokohama.label.includes('日本'),'Worldwide results kept');
assert.equal(direct.find(s=>s.city==='Lille').line,'Usine Nord, 5 Rue Principale');
assert.ok(calls[0].url.startsWith('https://photon.komoot.io/api/?'));assert.ok(calls[0].url.includes('lang=fr'));assert.ok(calls[0].init.headers['User-Agent']);assert.ok(calls[0].init.signal);
await assert.rejects(geo.searchAddresses('500 error',{}));
const {GET}=await import('../app/api/geocode/route.ts');
const get=(q,headers={})=>GET(new Request('https://gsl.test/api/geocode?'+q,{headers}));
let r=await get('q=ab');assert.equal(r.status,400);
r=await get('q=rue+de+rivoli&lang=fr&country=FR',{'sec-fetch-site':'cross-site'});assert.equal(r.status,403,'Not an open proxy for other sites');
const before=calls.length;r=await get('q=rue+de+rivoli&lang=fr&country=FR',{'sec-fetch-site':'same-origin','x-forwarded-for':'203.0.113.1'});assert.equal(r.status,200);
let body=await r.json();assert.equal(body.attribution,'© OpenStreetMap');assert.equal(body.results.length,5);assert.match(r.headers.get('cache-control'),/max-age=3600/);
r=await get('q=Rue+de+Rivoli&lang=fr&country=FR',{'x-forwarded-for':'203.0.113.1'});assert.equal(r.status,200);assert.equal(calls.length,before+1,'Second identical query served from cache');
r=await get('q=fail+please',{'x-forwarded-for':'203.0.113.2'});assert.equal(r.status,503);body=await r.json();assert.deepEqual(body.results,[],'Failure leaves the field as plain text');
let limited=0;for(let i=0;i<45;i++){const x=await get('q=street+'+i,{'x-forwarded-for':'203.0.113.3'});if(x.status===429)limited++;}
assert.ok(limited>0,'Per-client throttle protects the shared geocoder');
console.log('Address search: validation, worldwide mapping, country priority, cache, throttle, origin check and failure fallback passed (mocked geocoder).');

// ---------- Buyer defaults (lib/requirement-profile.ts) ----------
const {emptyRequirement}=await import('../lib/requirement.ts');
const prof=await import('../lib/requirement-profile.ts');
const userA='11111111-1111-4111-8111-111111111111',userB='22222222-2222-4222-8222-222222222222';
const store=new Map();const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
const done=emptyRequirement();done.contact={name:'Anne Martin, acheteuse',email:'anne@example.invalid',phone:'+33 1 23 45 67 89'};done.destination='FR';done.logistics={postalCode:'69007',address:'12 rue de Gerland',transport:false,customs:true};done.fields.city='Lyon';done.fields.frequency='Mensuelle';done.items=[{description:'Vis',quantity:'10',unit:'kg'}];
assert.ok(prof.writeDefaults(userA,prof.defaultsFromDraft(done,'33333333-3333-4333-8333-333333333333',{name:'Atelier Martin',country:'FR'},null),storage));
assert.equal(prof.readDefaults(userB,storage),null,'Another account never reads these answers');assert.equal(prof.readDefaults('not-an-id',storage),null);
const saved=prof.readDefaults(userA,storage);assert.equal(saved.company.name,'Atelier Martin');
const account={user:{id:userA,email:'anne@example.invalid',name:'Atelier Martin'},signup:{name:'Atelier Martin',country:'FR'},organizations:[]};
const filled=prof.applyDefaults(emptyRequirement(),saved,account,true);
assert.equal(filled.contact.name,'Anne Martin, acheteuse');assert.equal(filled.fields.city,'Lyon');assert.equal(filled.logistics.postalCode,'69007');assert.equal(filled.destination,'FR');assert.equal(filled.logistics.transport,false);assert.equal(filled.items[0].unit,'kg');assert.equal(filled.fields.frequency,'Mensuelle');
const typed=emptyRequirement();typed.contact.name='Paul';typed.fields.city='Nantes';
const kept=prof.applyDefaults(typed,saved,account,false);assert.equal(kept.contact.name,'Paul','Typed answers are never overwritten');assert.equal(kept.fields.city,'Nantes');assert.equal(kept.logistics.postalCode,'','Delivery block not mixed with another address');
const fresh=prof.applyDefaults(emptyRequirement(),null,account,true);assert.equal(fresh.contact.email,'anne@example.invalid');assert.equal(fresh.contact.name,'','A company name from sign-up is not used as a person name');
assert.deepEqual(prof.proposedCompany(account,null,''),{name:'Atelier Martin',country:'FR'});
const legacy={...account,signup:{name:'',country:''},user:{...account.user,name:'Société X'}};
assert.deepEqual(prof.proposedCompany(legacy,null,JSON.stringify({name:'Société X',country:'DE'})),{name:'Société X',country:'DE'});
assert.deepEqual(prof.proposedCompany(legacy,null,JSON.stringify({name:'Autre compte',country:'IT'})),{name:'',country:''},'A sign-up draft from another account in this browser is ignored');
console.log('Buyer defaults: per-account storage, empty-field pre-fill, no overwrite and sign-up company proposal passed.');

// ---------- Specification PDF (lib/requirement-pdf.ts) ----------
const {jsPDF}=await import('jspdf');
const pdf=await import('../lib/requirement-pdf.ts');
const font=p=>fs.readFileSync(p).toString('base64');
const assets={regular:font('public/fonts/inter/Inter-Regular.ttf'),semibold:font('public/fonts/inter/Inter-SemiBold.ttf'),logo:new Uint8Array(fs.readFileSync('public/brand/gsl-systems-logo.png'))};
const d=structuredClone(done);d.fields.title='Réducteurs harmoniques pour bras robotisé';d.fields.description='Réducteurs à onde de déformation pour l’articulation du coude d’un robot humanoïde. Fonctionnement silencieux, faible jeu, durée de vie ≥ 10 000 h.';d.fields.material='Acier 42CrMo4 traité, flexspline en acier à ressort';d.fields.quality='CE, RoHS, rapport de contrôle dimensionnel à 100 %';d.fields.documents='Plan 2D PDF, modèle STEP, fiche technique';d.fields.deliveryDate='2027-03-15';d.fields.packaging='Cartons unitaires antistatiques';
d.robotics={kind:'component',family:'transmissions-guidages',technical:{torque_nm:'120',backlash_arcmin:'≤ 1'},interface:'Bride ISO 9409-1-50-4-M6',environment:'Atelier, 5 à 40 °C'};
d.items=Array.from({length:14},(_,i)=>({description:`Réducteur harmonique taille ${14+i*3} — rapport 1:${50+i*10}, avec roulement à rouleaux croisés intégré et kit de montage`,quantity:String(20+i),unit:i%2?'pcs':'set'}));
d.customFields=[{id:crypto.randomUUID(),label:'Critères de réception',value:'Jeu mesuré ≤ 1 arcmin sur chaque pièce ; essai de rodage 2 h.'},{id:crypto.randomUUID(),label:'Compatibilité',value:'Interchangeable avec la série actuelle.'}];
const input={draft:d,language:'fr',date:new Date('2026-10-15T10:00:00Z'),company:{name:'Atelier Martin SAS',country:'FR'},status:'draft'};
const sections=pdf.specificationSections(input);
const titles=sections.sections.map(s=>s.title);
assert.deepEqual(titles,['Contexte et objet','Périmètre de la fourniture','Exigences techniques','Quantités et livraison','Conformité et normes','Documents attendus','Critères de réception','Confidentialité']);
assert.ok(sections.sections[2].rows.some(r=>r.label==='Couple (N·m)'&&r.value==='120'));assert.ok(sections.sections[2].rows.some(r=>r.label==='Compatibilité'));assert.ok(!sections.sections[2].rows.some(r=>r.label==='Critères de réception'));
assert.equal(sections.reference,pdf.draftReference(d,input.date),'Stable draft reference');assert.match(sections.reference,/^CDC-261015-[0-9A-Z]{6}$/);
const minimal=emptyRequirement();minimal.fields.title='Pièce';minimal.fields.description='Une description suffisamment longue.';minimal.items=[{description:'Pièce A',quantity:'2',unit:'pcs'}];minimal.destination='DE';
const few=pdf.specificationSections({draft:minimal,language:'en',date:input.date,status:'draft'}).sections.map(s=>s.title);
assert.deepEqual(few,['Context and purpose','Scope of supply','Quantities and delivery','Confidentiality'],'Empty sections are left out, nothing invented');
assert.equal(pdf.pdfLanguage('zh'),'en');assert.equal(pdf.pdfLanguage('de'),'de');
const doc=pdf.buildSpecificationPdf(jsPDF,input,assets);
const bytes=Buffer.from(doc.output('arraybuffer'));
assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(doc.getNumberOfPages()>=2,'Long item list flows onto further pages');
assert.ok(bytes.includes(Buffer.from('/FontFile2')),'Unicode TrueType font embedded');
const smallDoc=pdf.buildSpecificationPdf(jsPDF,{draft:minimal,language:'zh',date:input.date,status:'saved',reference:'GSL-261015-ABCDEF123456',revision:1},{...assets,logo:undefined});
assert.equal(smallDoc.getNumberOfPages(),1);
const out=process.argv[2];if(out){fs.writeFileSync(out,bytes);fs.writeFileSync(out.replace(/\.pdf$/,'-minimal.pdf'),Buffer.from(smallDoc.output('arraybuffer')));}
console.log(`Specification PDF: ${doc.getNumberOfPages()} pages, ${Math.round(bytes.length/1024)} KB, structured sections, embedded Inter font and footer page numbers passed.`);
