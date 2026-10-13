import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sourcePath=process.argv[2]||'data/gsl-70-source-2026-10-13.json';
const outputPath=process.argv[3]||'data/gsl-70-import-2026-10-13.json';
const raw=fs.readFileSync(sourcePath,'utf8'),s=JSON.parse(raw);
const country={Turquie:'TR',Maroc:'MA',Tunisie:'TN',Serbie:'RS','Macédoine du Nord':'MK','Bosnie-Herzégovine':'BA',Moldavie:'MD',Géorgie:'GE',Albanie:'AL','Égypte':'EG'};
const componentFamilies=new Set(['Périphériques robotiques','Commande et électronique','Actionnement','Capteurs et position','Câbles et connectique','Actionnement et capteurs','Cartes et électronique','Semi-conducteurs','Connectique et distribution électrique','Sous-ensembles et câblage','Bras et actionnement','Commande et interfaces','Commande électrique','Composants moteur et électronique','Composants électriques','Électronique de puissance']);
// Match the fixed UUIDv5 namespace of this reviewed batch; never derive identities from row order alone.
const namespace=Buffer.from('7a09ba5054d846bdb2134a6bd32ec5e7','hex');
function identity(key){const bytes=createHash('sha1').update(namespace).update(key).digest().subarray(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=bytes.toString('hex');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
if(s.values?.[0]?.[0]!=='ID'||s.values[0][5]!=='Statut'||!/^\d{4}-\d{2}-\d{2}$/.test(s.readAt))throw Error('Unexpected source headers or source date');
const seen=new Set();const rows=s.values.slice(1).map((row,index)=>{const [key,name,pays,site,family,level,description,group,production,robotics,limits,primary,secondary,checkedAt]=row;if(!key||seen.has(key)||!name||!country[pays]||!['A','B','C'].includes(level))throw Error('Invalid or duplicate source row '+(index+8));seen.add(key);return {id:identity(key),rowNumber:index+8,sourceId:key,name,country:country[pays],site:site||'',sourceFamily:family,sourceLevel:level,description:description||'',group:group||'',productionEvidence:production||'',roboticsApplication:robotics||'',pointsToConfirm:limits||'',checkedAt:checkedAt||s.readAt,dateBasis:checkedAt?'Date de la ligne source':'Date du tableau source',sources:[primary,secondary].filter(Boolean).map(url=>({url,title:'Source du tableau GSL — '+name,supports:'Éléments et réserves reproduits du tableau ; source à examiner avant publication.'})),componentScope:componentFamilies.has(family)};});
if(rows.length!==70)throw Error('Expected the reviewed 70-row batch, received '+rows.length);
fs.writeFileSync(outputPath,JSON.stringify({schemaVersion:1,batchId:'gsl-70-2026-10-13',source:'Tableau GSL — 70 fabricants et composants pour la robotique, onglet Entreprises, B7:O77',sourceDigest:createHash('sha256').update(raw).digest('hex'),rows},null,2)+'\n');
console.log(`${rows.length} staged candidates; ${rows.filter(r=>r.componentScope).length} component candidates. No publication, certification or supplier account created.`);
