import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const {sourcingCountries}=await import(data(compile('lib/sourcing-coverage.ts')));
const {sourcingAgreements,agreementNames}=await import(data(compile('lib/sourcing-agreements.ts')));
assert.deepEqual(sourcingAgreements.map(c=>c.code),sourcingCountries);
const dictionary=JSON.parse(fs.readFileSync('lib/i18n/sourcing.json','utf8'));
for(const c of sourcingAgreements){assert.ok(Number.isFinite(Date.parse(c.effective)));if(c.provisional)assert.ok(c.provisional<c.effective);assert.ok(c.sources.length);for(const source of c.sources)assert.equal(new URL(source).protocol,'https:');assert.equal(dictionary[c.note[0]].length,8);assert.ok(dictionary[c.note[0]].every(Boolean));}
for(const name of Object.values(agreementNames))assert.equal(dictionary[name[0]].length,8);
assert.equal(sourcingAgreements.find(c=>c.code==='TN').effective,'1998-03-01');
const languages=data(compile('lib/i18n/languages.ts'));
const {indexable,publicMetadata,privatePaths}=await import(data(compile('lib/seo.ts').replace("'./i18n/languages'",JSON.stringify(languages))));
process.env.GSL_ENVIRONMENT='production';process.env.GSL_PUBLIC_INDEXING_ENABLED='true';
for(const country of sourcingCountries){assert.ok(indexable('/pays/'+country.toLowerCase()));const metadata=publicMetadata('/pays/'+country.toLowerCase(),'Test','Test','fr');assert.equal(Object.keys(metadata.alternates.languages).length,11);}
for(const path of privatePaths){assert.equal(indexable(path),false);assert.equal(indexable(path+'/test'),false);}
for(const path of ['/messagerie','/mes-produits','/espace-fournisseur','/decrire-mon-besoin','/compte','/administration/securite'])assert.equal(indexable(path),false);
process.env.GSL_ENVIRONMENT='preview';assert.equal(indexable('/pays/tr'),false);
console.log('Country agreement consistency, ten-language notes, dates and production-only SEO exclusions passed.');
