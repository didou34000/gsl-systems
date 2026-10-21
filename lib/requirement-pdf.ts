/** "Cahier des charges" PDF for a buyer requirement, generated in the browser with jsPDF.
 *  The library, the Inter fonts (public/fonts/inter, Unicode, French accents) and the logo load only when the person exports.
 *  Only sections the form actually holds data for are printed; nothing is invented. */
import type {jsPDF as JsPDF} from 'jspdf';
import type {Language} from './i18n/languages';
import {translate} from './i18n/translations';
import {requirementFields,type Requirement,type RequirementKey} from './requirement';
import {roboticsFamilies,roboticsMetrics} from './robotics';
import {brandAssets} from './brand';

export type SpecificationInput={
 draft:Requirement;language:Language;date:Date;
 company?:{name:string;country:string};
 reference?:string;revision?:number;status:'draft'|'saved'|'submitted';
};
export type SpecificationAssets={regular:string;semibold:string;logo?:Uint8Array};
type Row={label:string;value:string};

// Latin-script languages are printed in that language; the embedded font has no Arabic, Devanagari or Chinese glyphs.
const latin:Language[]=['en','fr','es','pt','de','it','tr'];
export const pdfLanguage=(language:Language):Language=>latin.includes(language)?language:'en';
const steel:[number,number,number]=[31,78,121],ink:[number,number,number]=[20,25,31],slate:[number,number,number]=[90,101,113],border:[number,number,number]=[217,222,227],surface:[number,number,number]=[243,245,247];
const acceptance=/r[ée]ception|recette|acceptance|acceptation|crit[èe]res? d.?accept/i;

function hash(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36).toUpperCase().padStart(6,'0').slice(-6)}
/** A stable reference for an unsaved draft: same content, same reference. */
export function draftReference(d:Requirement,date:Date){const y=date.getFullYear()%100,m=date.getMonth()+1,day=date.getDate();return `CDC-${String(y).padStart(2,'0')}${String(m).padStart(2,'0')}${String(day).padStart(2,'0')}-${hash(JSON.stringify({f:d.fields,i:d.items,r:d.robotics,c:d.customFields}))}`}
export const specificationFileName=(reference:string)=>`GSL-cahier-des-charges-${reference.replace(/[^A-Za-z0-9-]+/g,'-')}.pdf`;

/** The document structure, separate from drawing so it can be tested. Sections without data are left out. */
export function specificationSections(input:SpecificationInput){
 const lang=pdfLanguage(input.language);const t=(en:string,fr:string)=>translate(lang,en,fr);const d=input.draft;
 const f=(key:RequirementKey)=>d.fields[key].trim();
 const label=(key:RequirementKey)=>{const field=requirementFields.find(x=>x.key===key)!;return t(field.en,field.fr)};
 const option=(key:RequirementKey)=>{const field=requirementFields.find(x=>x.key===key)!;const value=f(key);if('options'in field&&lang!=='fr'){const n=(field.options as readonly string[]).indexOf(value);if(n>=0)return translate(lang,field.english[n],value)}return value};
 const day=(iso:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return iso;const [y,m,dd]=iso.split('-').map(Number);return new Intl.DateTimeFormat(lang,{dateStyle:'long',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,dd)))};
 const region=(code:string)=>{try{return code?new Intl.DisplayNames([lang],{type:'region'}).of(code)||code:''}catch{return code}};
 const unit=(u:string)=>u==='pcs'?t('pieces','pièces'):u==='set'?t('sets','ensembles'):u==='m2'?'m²':u;
 const rows=(list:Row[])=>list.filter(r=>r.value.trim());
 const family=roboticsFamilies.find(x=>x.id===d.robotics.family);
 const kind=d.robotics.kind==='robot'?t('Complete robot','Robot complet'):d.robotics.kind==='custom'?t('Custom manufacturing','Fabrication sur mesure'):t('Standard component','Composant standard');
 const custom=d.customFields.filter(x=>x.label.trim()&&x.value.trim());
 const yes=(v:boolean)=>v?t('Yes','Oui'):t('No','Non');
 const sections:{title:string;rows?:Row[];text?:string;items?:boolean}[]=[];
 const context=rows([{label:t('Project','Projet'),value:f('title')},{label:t('Requirement type','Type de besoin'),value:kind},{label:t('Robotics family','Famille robotique'),value:family?t(family.en,family.fr):''}]);
 sections.push({title:t('Context and purpose','Contexte et objet'),rows:context,text:f('description')});
 if(d.items.some(i=>i.description.trim()))sections.push({title:t('Scope of supply','Périmètre de la fourniture'),items:true});
 const technical=rows([
  {label:label('material'),value:f('material')},{label:label('process'),value:f('process')},{label:label('dimensions'),value:f('dimensions')},{label:label('finish'),value:f('finish')},
  ...(roboticsMetrics[d.robotics.family]||[]).map(m=>({label:`${t(m.en,m.fr)} (${m.unit})`,value:(d.robotics.technical[m.key]||'').trim()})),
  {label:t('Interfaces / compatibility','Interfaces / compatibilité'),value:d.robotics.interface.trim()},{label:t('Environment and operating constraints','Environnement et contraintes d’usage'),value:d.robotics.environment.trim()},
  ...custom.filter(x=>!acceptance.test(x.label)).map(x=>({label:x.label.trim(),value:x.value.trim()})),
 ]);
 if(technical.length)sections.push({title:t('Technical requirements','Exigences techniques'),rows:technical});
 const delivery=rows([
  {label:label('frequency'),value:option('frequency')},{label:label('annualVolume'),value:f('annualVolume')},{label:label('samples'),value:f('samples')},{label:label('budget'),value:f('budget')},
  {label:t('Delivery country','Pays de livraison'),value:region(d.destination)},{label:label('city'),value:f('city')},{label:t('Delivery postal code','Code postal de livraison'),value:d.logistics.postalCode.trim()},{label:t('Delivery address','Adresse de livraison'),value:d.logistics.address.trim()},
  {label:label('deliveryDate'),value:f('deliveryDate')?day(f('deliveryDate')):''},{label:label('responseDate'),value:f('responseDate')?day(f('responseDate')):''},{label:label('flexibility'),value:f('flexibility')},
  {label:label('transport'),value:f('transport')},{label:label('packaging'),value:f('packaging')},
  {label:t('Transport study','Étude de transport'),value:yes(d.logistics.transport)},{label:t('Customs support','Accompagnement douanier'),value:yes(d.logistics.customs)},
 ]);
 sections.push({title:t('Quantities and delivery','Quantités et livraison'),rows:delivery});
 if(f('quality'))sections.push({title:t('Compliance and standards','Conformité et normes'),text:f('quality')});
 if(f('documents'))sections.push({title:t('Documents expected','Documents attendus'),text:f('documents')});
 const accept=custom.filter(x=>acceptance.test(x.label)).map(x=>({label:x.label.trim(),value:x.value.trim()}));
 if(accept.length)sections.push({title:t('Acceptance criteria','Critères de réception'),rows:accept});
 sections.push({title:t('Confidentiality','Confidentialité'),text:t('This document and its attachments are confidential. They are provided only so that a quotation can be prepared and must not be shared with third parties without the issuer’s consent.','Ce document et ses pièces jointes sont confidentiels. Ils sont communiqués uniquement pour l’établissement d’une offre et ne peuvent être diffusés à des tiers sans l’accord de l’émetteur.')});
 const reference=input.reference||draftReference(d,input.date);
 const meta=rows([
  {label:t('Reference','Référence'),value:reference},
  {label:t('Date','Date'),value:new Intl.DateTimeFormat(lang,{dateStyle:'long'}).format(input.date)},
  {label:t('Version','Version'),value:input.revision?String(input.revision):t('Draft','Brouillon')},
  {label:t('Status','Statut'),value:input.status==='submitted'?t('Sent to GSL','Transmis à GSL'):input.status==='saved'?t('Private draft saved','Brouillon privé enregistré'):t('Private draft, not sent to suppliers.','Brouillon privé, aucun envoi à un fournisseur.')},
 ]);
 const buyer=rows([
  {label:t('Company','Entreprise'),value:input.company?.name.trim()||''},{label:t('Company country','Pays de l’entreprise'),value:region(input.company?.country||'')},
  {label:t('Contact','Contact'),value:d.contact.name.trim()},{label:t('Email','Email'),value:d.contact.email.trim()},{label:t('Phone','Téléphone'),value:d.contact.phone.trim()},
 ]);
 const items=d.items.filter(i=>i.description.trim()).map((i,n)=>({n:String(n+1),description:i.description.trim(),quantity:i.quantity.trim(),unit:unit(i.unit)}));
 return {lang,t,reference,meta,buyer,sections,items,title:f('title')||t('Technical specification','Cahier des charges')};
}

/** Draws the PDF. `JsPDFClass` is injected so the library can be loaded on demand (browser) or imported directly (tests). */
export function buildSpecificationPdf(JsPDFClass:typeof JsPDF,input:SpecificationInput,assets:SpecificationAssets):JsPDF{
 const s=specificationSections(input);const {t}=s;
 const doc=new JsPDFClass({unit:'mm',format:'a4',compress:true});
 doc.addFileToVFS('Inter-Regular.ttf',assets.regular);doc.addFont('Inter-Regular.ttf','Inter','normal');
 doc.addFileToVFS('Inter-SemiBold.ttf',assets.semibold);doc.addFont('Inter-SemiBold.ttf','Inter','bold');
 doc.setProperties({title:`${t('Technical specification','Cahier des charges')}, ${s.title}`,subject:s.reference,author:input.company?.name||'GSL systems',creator:'GSL systems',keywords:s.reference});
 try{doc.setLanguage(s.lang as Parameters<JsPDF['setLanguage']>[0])}catch{}
 const W=210,H=297,M=18,CW=W-2*M,top=26,bottom=H-20;let y=M;
 const font=(weight:'normal'|'bold',size:number,color=ink)=>{doc.setFont('Inter',weight);doc.setFontSize(size);doc.setTextColor(...color)};
 const lh=(size:number)=>size*0.3528*1.45;
 const split=(text:string,width:number):string[]=>doc.splitTextToSize(text.replace(/\r\n?/g,'\n'),width);
 const newPage=()=>{doc.addPage();y=top};
 const room=(h:number)=>{if(y+h>bottom){newPage();return true}return false};

 // Title block
 if(assets.logo){try{doc.addImage(assets.logo,'PNG',M,M-2,34,34*brandAssets.height/brandAssets.width,'logo','FAST')}catch{}}
 font('normal',8.5,slate);doc.text('GSL systems',W-M,M+2,{align:'right'});doc.text(t('Robotics component sourcing','Sourcing de composants robotiques'),W-M,M+6.5,{align:'right'});
 y=M+24;
 font('bold',20,ink);doc.text(t('Technical specification','Cahier des charges'),M,y);y+=8.5;
 font('normal',13,steel);for(const line of split(s.title,CW)){doc.text(line,M,y);y+=lh(13)}
 y+=4;
 // Two information panels: document and buyer.
 // Label above value: long labels and translations never overlap the answer.
 const panel=(x:number,w:number,heading:string,rows:Row[])=>{font('normal',9);const lines=rows.map(r=>split(r.value,w-8));const h=11+lines.reduce((a,l)=>a+lh(7.5)+l.length*lh(9)+2,0)+1;
  doc.setFillColor(...surface);doc.setDrawColor(...border);doc.setLineWidth(0.2);doc.rect(x,y,w,h,'FD');font('bold',9,steel);doc.text(heading,x+4,y+6.5);let yy=y+12.5;
  rows.forEach((r,i)=>{font('normal',7.5,slate);doc.text(r.label,x+4,yy);yy+=lh(7.5);font('normal',9,ink);doc.text(lines[i],x+4,yy);yy+=lines[i].length*lh(9)+2});return h};
 const half=(CW-6)/2;
 const h1=panel(M,half,t('Document','Document'),s.meta);const h2=s.buyer.length?panel(M+half+6,half,t('Buyer','Acheteur'),s.buyer):0;
 y+=Math.max(h1,h2)+10;

 const heading=(n:number,title:string)=>{y+=3;room(16);font('bold',12,steel);doc.text(`${n}. ${title}`,M,y);y+=2.4;doc.setDrawColor(...border);doc.setLineWidth(0.3);doc.line(M,y,W-M,y);y+=6};
 const paragraph=(text:string)=>{font('normal',9.5,ink);for(const line of split(text,CW)){room(lh(9.5));doc.text(line,M,y);y+=lh(9.5)}y+=3};
 // Splits a row over pages only when it cannot fit on a fresh page; otherwise moves it whole.
 const capacity=(pad:number,size:number)=>Math.floor((bottom-top-2*pad)/lh(size));
 const chunk=(lines:number,done:number,pad:number,size:number,onBreak:()=>void)=>{let fit=Math.floor((bottom-y-2*pad)/lh(size));if(fit<1||(done===0&&lines>fit&&lines<=capacity(pad,size))){newPage();onBreak();fit=Math.floor((bottom-y-2*pad)/lh(size))}return Math.max(1,Math.min(fit,lines-done))};
 const table=(rows:Row[])=>{const lw=56,pad=2.2,vw=CW-lw;y-=2.5;
  for(const r of rows){font('normal',9);const labels=split(r.label,lw-2*pad),values=split(r.value,vw-2*pad);const total=Math.max(labels.length,values.length,1);let done=0;
   while(done<total){const n=chunk(total,done,pad,9,()=>{});const h=n*lh(9)+2*pad;const ls=labels.slice(done,done+n),vs=values.slice(done,done+n);
    doc.setDrawColor(...border);doc.setLineWidth(0.2);doc.setFillColor(...surface);doc.rect(M,y,lw,h,'FD');doc.rect(M+lw,y,vw,h,'S');
    font('normal',8.5,slate);if(ls.length)doc.text(ls,M+pad,y+pad+3.3);font('normal',9,ink);if(vs.length)doc.text(vs,M+lw+pad,y+pad+3.3);
    y+=h;done+=n}
  }y+=5};
 const itemsTable=()=>{y-=2.5;const cols=[{w:10,key:'n' as const,label:t('No.','N°')},{w:CW-10-28-24,key:'description' as const,label:t('Designation / reference','Désignation / référence')},{w:28,key:'quantity' as const,label:t('Quantity','Quantité')},{w:24,key:'unit' as const,label:t('Unit','Unité')}];const pad=2.4;
  const head=()=>{let x=M;doc.setFillColor(...surface);doc.setDrawColor(...border);doc.setLineWidth(0.2);doc.rect(M,y,CW,8,'FD');font('bold',8.5,ink);for(const [c,col] of cols.entries()){doc.text(col.label,c>=2?x+col.w-pad:x+pad,y+5.4,c>=2?{align:'right'}:undefined);x+=col.w}y+=8};
  room(20);head();
  for(const item of s.items){font('normal',9);const cells=cols.map(c=>split(item[c.key],c.w-2*pad));const total=Math.max(...cells.map(c=>c.length));let done=0;
   while(done<total){const n=chunk(total,done,pad,9,head);const h=n*lh(9)+2*pad;let x=M;doc.setDrawColor(...border);doc.setLineWidth(0.2);
    for(const [c,col] of cols.entries()){doc.rect(x,y,col.w,h,'S');const part=cells[c].slice(done,done+n);font('normal',9,c===0?slate:ink);if(part.length)doc.text(part,c>=2?x+col.w-pad:x+pad,y+pad+3.3,c>=2?{align:'right'}:undefined);x+=col.w}
    y+=h;done+=n}
  }y+=5};

 s.sections.forEach((section,i)=>{heading(i+1,section.title);if(section.rows?.length)table(section.rows);if(section.items)itemsTable();if(section.text)paragraph(section.text)});

 // Running header (from page 2) and footer with page numbers.
 const pages=doc.getNumberOfPages();
 for(let p=1;p<=pages;p++){doc.setPage(p);doc.setDrawColor(...border);doc.setLineWidth(0.3);
  if(p>1){font('normal',8,slate);const head=split(`GSL systems · ${t('Technical specification','Cahier des charges')} · ${s.title}`,CW-30)[0];doc.text(head,M,13);doc.text(s.reference,W-M,13,{align:'right'});doc.line(M,16,W-M,16)}
  doc.line(M,H-14,W-M,H-14);font('normal',8,slate);doc.text(`${s.reference} · ${t('Confidential','Confidentiel')}`,M,H-9);doc.text(`${t('Page','Page')} ${p} / ${pages}`,W-M,H-9,{align:'right'});
 }
 return doc;
}

function base64(bytes:Uint8Array){let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(out)}
/** Browser entry point: loads jsPDF, fonts and logo on demand, then downloads the PDF. */
export async function downloadSpecificationPdf(input:SpecificationInput){
 const [{jsPDF},regular,semibold,logo]=await Promise.all([
  import('jspdf'),
  fetch('/fonts/inter/Inter-Regular.ttf').then(r=>{if(!r.ok)throw Error('FONT');return r.arrayBuffer()}),
  fetch('/fonts/inter/Inter-SemiBold.ttf').then(r=>{if(!r.ok)throw Error('FONT');return r.arrayBuffer()}),
  fetch(brandAssets.logo).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null),
 ]);
 const doc=buildSpecificationPdf(jsPDF,input,{regular:base64(new Uint8Array(regular)),semibold:base64(new Uint8Array(semibold)),logo:logo?new Uint8Array(logo):undefined});
 const reference=input.reference||draftReference(input.draft,input.date);
 doc.save(specificationFileName(reference));
}
