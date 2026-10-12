import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const {languageOptions,isLanguage,resolveLanguage,languageDirection,localizedHref}=await import(dataUrl(compile('lib/i18n/languages.ts')));
assert.equal(languageOptions.length,10);
assert.equal(new Set(languageOptions.map(x=>x.code)).size,10);
for(const {code} of languageOptions){assert.ok(isLanguage(code));assert.equal(resolveLanguage(code),code);}
for(const invalid of [undefined,null,{},'','xx','EN','__proto__','fr<script>']){assert.equal(isLanguage(invalid),false);assert.equal(resolveLanguage(invalid),'en');}
assert.equal(languageDirection('ar'),'rtl');
assert.equal(languageDirection('zh'),'ltr');
assert.equal(localizedHref('/compte?vue=parametres#security','ar'),'/compte?vue=parametres&lang=ar#security');
assert.equal(localizedHref('/catalogue?q=steel&lang=fr','en'),'/catalogue?q=steel');
assert.equal(localizedHref('/catalogue?lang=fr','zh'),'/catalogue?lang=zh');
for(const href of ['https://example.com/','//example.com/','mailto:test@example.com','#details','/api/account/export'])assert.equal(localizedHref(href,'ar'),href);

const dictionaries={};let source=compile('lib/i18n/translations.ts');
for(const file of fs.readdirSync('lib/i18n').filter(name=>name.endsWith('.json'))){
 const rows=JSON.parse(fs.readFileSync('lib/i18n/'+file,'utf8'));
 for(const [key,row] of Object.entries(rows)){
  assert.ok(key.trim(),file+' has an empty key');
  assert.equal(row.length,8,file+': '+key+' requires all eight additional translations');
  assert.ok(row.every(value=>typeof value==='string'&&value.trim()),file+': '+key+' contains an empty translation');
 }
 Object.assign(dictionaries,rows);
 source=source.replace("'./"+file+"'",JSON.stringify(dataUrl('export default '+JSON.stringify(rows))));
}
const {translate,translations}=await import(dataUrl(source));
assert.equal(translate('fr','Saved','Enregistré'),'Enregistré');
assert.equal(translate('es','Sign in','Se connecter'),'Iniciar sesión');
assert.equal(translate('ar','Messages','Messages'),'الرسائل');
assert.equal(translate('zh','New request','Nouvelle demande'),'新建询价');
assert.equal(translate('es','Company photo 2','Photo de l’entreprise 2'),'Foto de empresa 2');
assert.equal(translate('ar','Remove photo 3','Retirer la photo 3'),'إزالة الصورة 3');
assert.equal(translate('de','Product 2 — Email address: check the format or length.',''),'Produkt 2 — E-Mail-Adresse: Format oder Länge prüfen.');
assert.equal(translate('de','An untranslated technical term','Terme non traduit'),'An untranslated technical term');

// A newly added label on a critical workflow must ship in all ten languages.
// The AST checks the actual interface rather than a hand-maintained sample list.
const critical=['compare-product','product-comparison','catalogue-cards','live-directory','site-header','member-dashboard','auth-form','account-security','account-data','messaging','thread-messages','operational-platform','operations-overview','offer-tools','rfq-composer','organization-members','recipient-picker','add-recipient','requirement-builder','marketplace','saved-selection','contact-form','industrial-home','catalogue-live','home-catalogue','network-marketplace','sourcing-network','public-profiles','supplier-workspace','company-branding','request-files','review-tools','workspace-shell'];
let checked=0;
for(const file of critical){
 const ast=ts.createSourceFile(file,fs.readFileSync('app/'+file+'.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='l'&&node.arguments.length>1&&ts.isStringLiteral(node.arguments[0])){
   const key=node.arguments[0].text;
   assert.ok(translations[key],'Missing core translation: '+file+' → '+key);
   checked++;
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);
}
const countries=JSON.parse(fs.readFileSync('lib/maps/country-labels.json','utf8'));
const countryRequirements=ts.createSourceFile('country-requirements.ts',fs.readFileSync('lib/onboarding/country-requirements.ts','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let checkedRequirements=0;
function checkCountryRequirements(node){
 if(ts.isCallExpression(node)){
  const name=node.expression.getText(countryRequirements);
  const key=name==='label'?node.arguments[0]:name==='field'?node.arguments[1]:undefined;
  if(key&&ts.isStringLiteral(key)){assert.ok(translations[key.text],'Missing country requirement: '+key.text);checkedRequirements++;}
 }
 ts.forEachChild(node,checkCountryRequirements);
}
checkCountryRequirements(countryRequirements);
for(const {code} of languageOptions){
 assert.equal(countries[code].length,countries.en.length);
 assert.equal(new Set(countries[code].map(row=>row.code)).size,countries.en.length);
 assert.ok(countries[code].every(row=>row.name.trim()));
}
assert.equal(countries.ar.find(row=>row.code==='FR').name,'فرنسا');
assert.equal(countries.zh.find(row=>row.code==='FR').name,'法国');
const catalogue=dataUrl(compile('lib/catalog.ts'));
const catalogueSource=compile('lib/catalog-languages.ts').replace("'./catalog'",JSON.stringify(catalogue));
const {normalizeSearch,matchesSearch}=await import(dataUrl(catalogueSource));
assert.equal(normalizeSearch('  ألمنيوم  ').normalize('NFC'),'ألمنيوم');
assert.ok(matchesSearch(['上海机械制造'], '上海'));
assert.ok(matchesSearch(['उद्योग उपकरण'], 'उपकरण'));
console.log(`Ten-language routing, fallback, Arabic direction, country names, non-Latin search, ${checked} critical interface strings and ${checkedRequirements} country requirements passed (${Object.keys(translations).length} dictionary entries).`);
