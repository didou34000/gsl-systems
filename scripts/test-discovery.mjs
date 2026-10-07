import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const dataUrl=js=>'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const catalogue=dataUrl(compile(fs.readFileSync('lib/catalog.ts','utf8')));
const source=compile(fs.readFileSync('lib/catalog-languages.ts','utf8')).replaceAll("'./catalog'",JSON.stringify(catalogue));
const {findDemoProducts,findDemoSuppliers,localProduct}=await import(dataUrl(source));
const {products,countries}=await import(catalogue);
assert.deepEqual(findDemoProducts({query:'laser cutting',country:'Turquie',category:'metal',maxQuantity:'50'}).map(p=>p.id),['tolerie-laser']);
assert.deepEqual(findDemoProducts({query:'pièces usinées'}).map(p=>p.id),['pieces-usinees-cnc']);
assert.deepEqual(findDemoProducts({query:'cnc ALUMINIUM'}).map(p=>p.id),['pieces-usinees-cnc']);
assert.equal(findDemoProducts({query:'CNC',country:'Maroc'}).length,0);
assert.equal(findDemoProducts({category:'textile',process:'Usinage CNC'}).length,0);
assert.equal(findDemoProducts({query:'no-such-capability'}).length,0);
assert.equal(findDemoProducts({}).length,12);
assert.deepEqual(findDemoSuppliers({query:'Georgia welding'}).map(s=>s.id),['caucasus-metalworks']);
assert.deepEqual(findDemoSuppliers({query:'Bursa',process:'Fraisage 5 axes'}).map(s=>s.id),['anatolia-precision']);
assert.equal(findDemoSuppliers({country:'Tunisie',category:'metal'}).length,0);
assert.equal(findDemoProducts({sort:'quantity'})[0].id,'tables-atelier');
// Flags are local SVG assets now; the removed emoji helper is no longer a public API.
assert.equal(countries.find(country=>country.name==='Turquie').code,'TR');
for(const country of countries)assert.ok(fs.existsSync('public/flags/'+country.code.toLowerCase()+'.svg'));
for(const p of products){assert.equal(localProduct(p,'fr'),p);assert.notEqual(localProduct(p,'en').name,p.name);assert.equal(localProduct(p,'en').id,p.id);assert.equal(localProduct(p,'en').supplierId,p.supplierId)}
console.log('Discovery checks passed: bilingual search, combined filters, ordering, flags and product/supplier identity.');
