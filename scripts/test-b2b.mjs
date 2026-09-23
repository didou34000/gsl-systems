import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
// Isolated test database. No fixtures, reviewer grants or identity overrides are
// bundled into the deployed application. HTTP exercises the production handler.
const dir=resolve('.sites-runtime/b2b-tests');mkdirSync(dir,{recursive:true});
const modulePath=dir+'/api.mjs';writeFileSync(modulePath,ts.transpileModule(readFileSync('lib/b2b/api.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {handleBusiness}=await import(pathToFileURL(modulePath));
const file=dir+'/test.sqlite';rmSync(file,{force:true});let sqlite=new DatabaseSync(file);sqlite.exec('PRAGMA foreign_keys=ON');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
class Statement{constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...a){return new Statement(this.sql,a)}async first(){return sqlite.prepare(this.sql).get(...this.args)||null}async all(){return {results:sqlite.prepare(this.sql).all(...this.args)}}async run(){const r=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(r.changes)}}}}
const db={prepare:sql=>new Statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const users=Object.fromEntries(['A','B','C','D','R'].map(id=>[id,{userId:'test-'+id,email:id+'@example.invalid',displayName:'Test '+id}]));
sqlite.prepare('INSERT INTO reviewers VALUES (?,?,?)').run(users.R.userId,'isolated-test-fixture',new Date().toISOString());
const server=createServer(async(req,res)=>{try{let body='';for await(const chunk of req)body+=chunk;const headers=new Headers(req.headers);const request=new Request(base+req.url,{method:req.method,headers,body:req.method==='GET'?undefined:body});const response=await handleBusiness(request,{db,user:users[req.headers.authorization?.replace('Bearer ','')]||null});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text())}catch(e){res.statusCode=500;res.end(String(e))}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let assertions=0;
async function call(user,body=null,view='dashboard',expected=200,origin=base){const r=await fetch(base+'/?view='+view,{method:body===null?'GET':'POST',headers:{...(user?{Authorization:'Bearer '+user}:{}),Origin:origin,'Content-Type':'application/json'},...(body===null?{}:{body:JSON.stringify(body)})});const data=await r.json();assert.equal(r.status,expected,JSON.stringify({user,body,view,data}));assertions++;return data}
const snapshot=u=>call(u);
const orgBody=(kind,name)=>({action:'create_org',kind,name,country:'Turquie',description:'Entreprise fictive de test, aucun fabricant réel.'});
const productBody={action:'save_product',name:'Composant industriel TEST',category:'Métal',description:'Une pièce de test en aluminium avec tolérances et dimensions sur plan.',moq:100,priceCents:1250};
async function transition(user,action,target,row,extra={}){return call(user,{action,target,id:row.id,revision:row.revision,...extra})}
async function approveAndPublish(user,target,key){let s=await snapshot(user);let row=target==='org'?s.org:s.products.find(p=>p.id===key);await transition(user,'submit',target,row);s=await snapshot(user);row=target==='org'?s.org:s.products.find(p=>p.id===key);await transition('R','review',target,row,{decision:'approved',note:'Vérification de test explicite, aucune certification.'});s=await snapshot(user);row=target==='org'?s.org:s.products.find(p=>p.id===key);await transition(user,'publish',target,row,{published:true})}
try{
 await call(null,null,'dashboard',401);await call('A',{...orgBody('buyer','A'),role:'admin'},'dashboard',400);await call('A',orgBody('buyer','Acheteur A'));await call('B',orgBody('supplier','Fournisseur B'));await call('C',orgBody('buyer','Tiers C'));await call('D',orgBody('supplier','Fournisseur D'));
 const A=(await snapshot('A')).org,B=(await snapshot('B')).org,D=(await snapshot('D')).org;
 await call('A',null,'reviews',403);await call('B',null,'org&id='+A.id,403);await call('A',{action:'edit_org',id:B.id,revision:B.revision,name:'Vol de fiche',country:'France',description:'Tentative interdite via API directe'},'dashboard',403);
 await call('A',orgBody('buyer','Autre société'),'dashboard',409);await call('A',productBody,'dashboard',403);await call('B',productBody,'dashboard',403,'https://attacker.invalid');
 const p=await call('B',productBody);let bp=(await snapshot('B')).products[0];await call('C',null,'product&id='+p.id,403);await call('D',{...productBody,id:p.id,revision:bp.revision},'dashboard',403);
 await transition('B','publish','product',bp,{published:true}).then(()=>assert.fail('unreviewed publish accepted')).catch(e=>{assert.match(String(e),/409/);assertions++});
 await transition('B','review','product',bp,{decision:'approved',note:'Self approval must fail'}).then(()=>assert.fail('self approval accepted')).catch(e=>{assert.match(String(e),/403/);assertions++});
 assert.equal((await call('A',null,'catalogue')).products.length,0);
 await approveAndPublish('B','org');await approveAndPublish('D','org');await approveAndPublish('B','product',p.id);
 assert.equal((await call('A',null,'catalogue&q=Composant')).products[0].id,p.id);assertions++;
 const rejected=await call('D',{...productBody,name:'Produit rejeté TEST'});let dp=(await snapshot('D')).products[0];await transition('D','submit','product',dp);dp=(await snapshot('D')).products[0];await transition('R','review','product',dp,{decision:'rejected',note:'Spécifications manquantes.'});assert.equal((await call('A',null,'catalogue&q=rejet')).products.length,0);assertions++;
 bp=(await snapshot('B')).products[0];await call('B',{...productBody,id:p.id,revision:bp.revision,name:'Composant révisé TEST'});assert.equal((await call('A',null,'catalogue')).products.length,0);assertions++;
 await call('B',{...productBody,id:p.id,revision:bp.revision},'dashboard',409);await approveAndPublish('B','product',p.id);
 await call('B',{action:'document',productId:p.id,label:'Déclaration test',reference:'TEST-001',issuer:'Émetteur de test',scope:'Référence exacte du composant de test, document non certifié.'});const doc=(await snapshot('B')).documents[0];await call('D',{action:'document',productId:p.id,label:'Document volé',reference:'BAD',issuer:'Faux test',scope:'Doit être rejeté par les autorisations'},'dashboard',403);await transition('R','review','document',doc,{decision:'rejected',note:'Document réel à fournir avant revue.'});assert.equal((await snapshot('B')).documents[0].status,'needs_changes');assertions++;
 const rfqBody={action:'save_rfq',title:'Demande TEST A',quantity:500,details:'Besoin de composants aluminium sur plan, livraison Paris, délai souhaité 30 jours.'};const req=await call('A',rfqBody);let draft=(await snapshot('A')).rfqs[0];await call('C',null,'rfq&id='+req.id,403);await call('C',{...rfqBody,id:req.id,revision:draft.revision},'dashboard',403);await call('B',rfqBody,'dashboard',403);
 await call('A',{...rfqBody,id:req.id,revision:draft.revision,quantity:600});await call('A',{action:'send_rfq',id:req.id,revision:draft.revision,suppliers:[B.id]},'dashboard',409);draft=(await snapshot('A')).rfqs[0];await call('A',{action:'send_rfq',id:req.id,revision:draft.revision,suppliers:[B.id,D.id]});await call('A',{action:'send_rfq',id:req.id,revision:draft.revision,suppliers:[B.id]},'dashboard',409);
 const bt=(await snapshot('B')).threads[0],dt=(await snapshot('D')).threads[0];assert.equal(bt.rfq_id,req.id);assert.equal((await snapshot('A')).threads.length,2);assertions+=2;
 await call('C',null,'thread&id='+bt.id,403);await call('D',null,'thread&id='+bt.id,403);await call('B',null,'thread&id='+dt.id,403);await call('C',{action:'message',threadId:bt.id,body:'intrusion'},'dashboard',403);
 await call('B',{action:'offer',threadId:bt.id,amountCents:750000,leadDays:21,terms:'Total HT pour 600 pièces, hors transport. Valable 30 jours.'});await call('A',{action:'offer',threadId:bt.id,amountCents:100,leadDays:1,terms:'Usurpation de rôle fournisseur'},'dashboard',403);await call('A',{action:'message',threadId:bt.id,body:'Merci, pouvez-vous préciser la finition ?'});await call('B',{action:'message',threadId:bt.id,body:'Finition anodisée incluse dans la proposition.'});
 sqlite.close();sqlite=new DatabaseSync(file);sqlite.exec('PRAGMA foreign_keys=ON');const persistent=await call('A',null,'thread&id='+bt.id);assert.equal(persistent.offers[0].amount_cents,'750000');assert.equal(persistent.messages.length,2);assert.equal(persistent.thread.quantity,'600');assertions+=3;
 const sent=(await snapshot('A')).rfqs[0];await call('A',{...rfqBody,id:sent.id,revision:sent.revision},'dashboard',409);await call('A',{action:'delete_rfq',id:sent.id,revision:sent.revision},'dashboard',409);
 const disposable=await call('A',{...rfqBody,title:'Brouillon à supprimer'});const before=(await snapshot('A')).rfqs.find(r=>r.id===disposable.id);await call('C',{action:'delete_rfq',id:before.id,revision:before.revision},'dashboard',403);await call('A',{action:'delete_rfq',id:before.id,revision:before.revision});assert.ok(!(await snapshot('A')).rfqs.some(r=>r.id===before.id));assertions++;
 assert.equal((await snapshot('C')).threads.length,0);assert.equal((await snapshot('C')).rfqs.length,0);assertions+=2;
 console.log(`PASS: ${assertions} HTTP/status/data assertions; identities A/B/C/D/reviewer; real SQLite persistence reopened.`);
}finally{await new Promise(r=>server.close(r));sqlite.close();rmSync(file,{force:true})}
