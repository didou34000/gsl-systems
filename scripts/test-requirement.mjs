import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const iso='data:text/javascript;base64,'+Buffer.from(compile('lib/onboarding/iso-countries.ts')).toString('base64');
const dictionaries={};
for(const name of fs.readdirSync('lib/i18n').filter(name=>name.endsWith('.json'))){dictionaries['./'+name]='data:text/javascript;base64,'+Buffer.from('export default '+fs.readFileSync('lib/i18n/'+name,'utf8')).toString('base64');}
let translationSource=compile('lib/i18n/translations.ts');
for(const [name,url] of Object.entries(dictionaries))translationSource=translationSource.replace(JSON.stringify(name),JSON.stringify(url)).replace("'"+name+"'",JSON.stringify(url));
const translations='data:text/javascript;base64,'+Buffer.from(translationSource).toString('base64');
const robotics='data:text/javascript;base64,'+Buffer.from(compile('lib/robotics.ts')).toString('base64');
const code=compile('lib/requirement.ts').replace("'./i18n/translations'",JSON.stringify(translations)).replace("'./onboarding/iso-countries'",JSON.stringify(iso)).replace("'./robotics'",JSON.stringify(robotics)).replace("'zod'",JSON.stringify(pathToFileURL(process.cwd()+'/node_modules/zod/index.js').href));
const {emptyRequirement,requirementSchema,requirementIssues,requirementDetails,requirementExport,requirementFields}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const d=emptyRequirement();
assert.deepEqual(requirementIssues(d,0,'2026-10-02'),['title','description']);
assert.deepEqual(requirementIssues(d,1,'2026-10-02'),['items']);
assert.deepEqual(requirementIssues(d,2,'2026-10-02'),['destination']);
d.fields.title='Boîtier industriel';d.fields.description='Aluminium usiné selon plan pour un capteur industriel.';
d.items=[{description:'Pièce A',quantity:'250,5',unit:'kg'},{description:'Pièce B',quantity:'500',unit:'pcs'}];d.destination='JP';
for(let step=0;step<3;step++)assert.deepEqual(requirementIssues(d,step,'2026-10-02'),[]);
for(const q of ['0','-1','1e5','1.2.3','NaN','1000000000001']){const x=structuredClone(d);x.items[0].quantity=q;assert.deepEqual(requirementIssues(x,1,'2026-10-02'),['items']);}
for(const q of ['1 250,5','1\u202f250.5']){const x=structuredClone(d);x.items[0].quantity=q;assert.deepEqual(requirementIssues(x,1,'2026-10-02'),[]);}
for(const date of ['2027-02-29','2027-13-01','not-a-date']){const x=structuredClone(d);x.fields.deliveryDate=date;assert.ok(requirementIssues(x,2,'2026-10-02').includes('deliveryDate'));}
d.fields.responseDate='2026-12-20';d.fields.deliveryDate='2026-12-01';assert.ok(requirementIssues(d,2,'2026-10-02').includes('dateOrder'));
d.fields.responseDate='2026-09-01';assert.ok(requirementIssues(d,2,'2026-10-02').includes('responseDate'));
d.fields.responseDate='2026-11-01';assert.deepEqual(requirementIssues(d,2,'2026-10-02'),[]);
for(const f of requirementFields){if(!d.fields[f.key])d.fields[f.key]='Détail '+f.key;}
d.fields.frequency='Trimestrielle';
const fr=requirementDetails(d,'fr'),en=requirementDetails(d,'en');
for(const f of requirementFields.filter(f=>f.key!=='title'))assert.ok(fr.includes(d.fields[f.key]),f.key+' retained in saved brief');
assert.ok(en.includes('Quarterly'));assert.ok(en.includes('Japan'));assert.ok(requirementExport(d,'fr').includes('250,5 kg'));
assert.ok(requirementSchema.safeParse(JSON.parse(JSON.stringify(d))).success);
assert.equal(requirementSchema.safeParse({...d,destination:'ZZ'}).success,false);
assert.equal(requirementSchema.safeParse({...d,items:[]}).success,false);
assert.equal(requirementSchema.safeParse({...d,items:Array(51).fill(d.items[0])}).success,false);
const maximum=emptyRequirement();for(const f of requirementFields)maximum.fields[f.key]='x'.repeat('max'in f?f.max:100);maximum.destination='FR';assert.ok(requirementDetails(maximum,'fr').length<=10000,'Serialized details fit backend limit');
console.log('Requirement validation, full-detail serialization, decimal quantities and restore schema passed.');

const custom=emptyRequirement();custom.mode='custom';custom.fields.title='Pièce spéciale';custom.fields.description='Un besoin industriel libre et spécifique.';custom.customFields=[{id:crypto.randomUUID(),label:'Compatibilité machine',value:'Bride M12, entraxe à confirmer sur plan.'}];
assert.ok(requirementDetails(custom,'fr').includes('Compatibilité machine\nBride M12'));
assert.ok(requirementExport(custom,'fr').includes('Compatibilité machine'));
const restored=requirementSchema.parse(JSON.parse(JSON.stringify(custom)));assert.equal(restored.mode,'custom');assert.equal(restored.customFields[0].value,custom.customFields[0].value);
assert.equal(requirementSchema.parse({fields:d.fields,items:d.items,destination:d.destination}).mode,'guided','Legacy drafts still load');
custom.customFields[0].label='';assert.ok(requirementIssues(custom,0,'2026-10-02').includes('customFields'));
custom.customFields=Array.from({length:6},()=>({id:crypto.randomUUID(),label:'Spécification',value:'x'.repeat(2000)}));assert.ok(requirementIssues(custom,2,'2026-10-02').includes('detailsLimit'));
console.log('Custom enquiry: editable sections, exports, restore, legacy compatibility and payload length guard passed.');

for(const language of ['en','fr','es','pt','de','it','tr','ar','hi','zh']){
 const details=requirementDetails(d,language);
 assert.ok(details.includes(d.fields.description),'User-authored specifications survive '+language+' export');
 assert.ok(requirementExport(d,language).includes('250,5 kg'),'User-authored quantities survive '+language+' export');
 assert.ok(requirementIssues(custom,2,'2026-10-02',language).includes('detailsLimit'),'Aggregate limit enforced in '+language);
}
console.log('Ten-language request exports preserve user content and enforce serialized length limits.');

const robotic=emptyRequirement();robotic.robotics={kind:'robot',family:'robots-plateformes',technical:{payload_kg:'12',reach_mm:'800'},interface:'EtherCAT',environment:'Atelier sec'};
assert.ok(requirementExport(robotic,'fr').includes('Charge utile (kg) : 12'));
assert.ok(requirementDetails(robotic,'en').includes('Reach (mm) : 800'));
assert.deepEqual(requirementSchema.parse(JSON.parse(JSON.stringify(robotic))).robotics,robotic.robotics);
const legacy={...robotic};delete legacy.robotics;assert.equal(requirementSchema.parse(legacy).robotics.kind,'component');
assert.equal(requirementSchema.safeParse({...robotic,robotics:{...robotic.robotics,family:'textile'}}).success,false);
console.log('Robotics requests retain family, units, requirements and legacy drafts.');
