import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
async function loadModule(path){const source=await readFile(new URL(path,import.meta.url),'utf8');const code=transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
const {adminLanguages,adminTranslationKeys,adminTranslationCoverage,adminTranslate}=await loadModule('../lib/admin/translations.ts');
assert.equal(adminLanguages.length,10);
for(const {code} of adminLanguages){
  assert.equal(adminTranslationCoverage[code],adminTranslationKeys.length,`${code}: missing translations`);
  for(const key of adminTranslationKeys)assert.ok(adminTranslate(code,key).trim(),`${code}.${key}: empty translation`);
}
assert.equal(adminTranslate('fr','overview'),'Vue d’ensemble');
assert.equal(adminTranslate('ar','inbox'),'البريد الوارد');
assert.equal(adminTranslate('not-a-locale','overview'),'Overview');
const {adminCsv,adminCsvCell}=await loadModule('../lib/admin/csv.ts');
for(const hostile of ['=HYPERLINK("https://evil.invalid")','+SUM(1,2)','-1+2','@SUM(1,2)','   =1','\t=1','\r=1','\n=1','\u0000=1','\uFEFF=1']){
  assert.ok(adminCsvCell(hostile).startsWith('"\''),'CSV formula not neutralised: '+JSON.stringify(hostile));
}
assert.equal(adminCsvCell('A "quoted", field'),'"A ""quoted"", field"');
assert.equal(adminCsvCell('line 1\nline 2'),'"line 1\nline 2"');
assert.equal(adminCsvCell(null),'""');
assert.equal(adminCsvCell(12),'"12"');
assert.equal(adminCsv([['Nom','Sujet'],['Zoé','A, B']]),'\uFEFF"Nom","Sujet"\r\n"Zoé","A, B"');
console.log(`Admin UI checks passed: ${adminTranslationKeys.length} complete labels in each of 10 languages; spreadsheet formula prevention, quotes, delimiters, multiline text and UTF-8 CSV.`);
