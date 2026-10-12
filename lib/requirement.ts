import type {Language} from './i18n/languages';
import {translate} from './i18n/translations';
import {z} from 'zod';
import {roboticsMetrics,roboticsFamilies} from './robotics';
import {countryCodes} from './onboarding/iso-countries';
export const requirementFields=[
 {key:'title',step:0,fr:'Nom de votre projet',en:'Project title',required:true,max:160,placeholder:'Ex. Fabrication de boîtiers aluminium'},
 {key:'description',step:0,fr:'Produit, usage et caractéristiques',en:'Product, use and specifications',required:true,large:true,max:2500,placeholder:'Décrivez la pièce ou le produit, son utilisation et les caractéristiques essentielles.'},
 {key:'material',step:0,fr:'Matières et nuances',en:'Materials and grades',max:250},
 {key:'process',step:0,fr:'Procédés de fabrication',en:'Manufacturing processes',max:250},
 {key:'dimensions',step:0,fr:'Dimensions, poids et tolérances',en:'Dimensions, weight and tolerances',max:500},
 {key:'finish',step:0,fr:'Finition, couleur et personnalisation',en:'Finish, colour and customisation',max:500},
 {key:'frequency',step:1,fr:'Fréquence des commandes',en:'Order frequency',options:['À définir','Commande ponctuelle','Mensuelle','Trimestrielle','Annuelle'],english:['To be confirmed','One-off order','Monthly','Quarterly','Annual']},
 {key:'annualVolume',step:1,fr:'Volume annuel prévisionnel (avec unité)',en:'Estimated annual volume (including unit)',max:250},
 {key:'samples',step:1,fr:'Prototypes ou échantillons souhaités',en:'Prototypes or samples required',max:500},
 {key:'budget',step:1,fr:'Budget cible',en:'Target budget',max:250,placeholder:'Ex. 15 000 EUR au total ou 3 EUR / pièce'},
 {key:'responseDate',step:2,fr:'Réponse attendue avant le',en:'Quote response by',type:'date'},
 {key:'deliveryDate',step:2,fr:'Livraison souhaitée le',en:'Requested delivery date',type:'date'},
 {key:'flexibility',step:2,fr:'Souplesse sur les délais / livraisons fractionnées',en:'Deadline flexibility / split deliveries',max:500},
 {key:'city',step:2,fr:'Ville et code postal de livraison',en:'Delivery city and postal code',max:250},
 {key:'transport',step:2,fr:'Transport et conditions de livraison',en:'Transport and delivery terms',max:500,placeholder:'Ex. livraison à notre entrepôt, transport à chiffrer séparément…'},
 {key:'packaging',step:2,fr:'Conditionnement et volume logistique',en:'Packaging and shipment volume',max:500,placeholder:'Ex. cartons de 50 pièces, palettes, dimensions, m³…'},
 {key:'quality',step:2,fr:'Normes, certifications et contrôles attendus',en:'Standards, certifications and quality checks',large:true,max:1000},
 {key:'documents',step:2,fr:'Plans, fichiers et autres informations à fournir',en:'Drawings, files and other information to provide',large:true,max:1000},
] as const;
export type RequirementKey=typeof requirementFields[number]['key'];
const textShape=Object.fromEntries(requirementFields.map(f=>[f.key,z.string().max('max'in f?f.max:100)])) as Record<RequirementKey,z.ZodString>;
export const requirementSchema=z.object({robotics:z.object({kind:z.enum(['robot','component','custom']).default('component'),family:z.string().refine(v=>!v||roboticsFamilies.some(f=>f.id===v)).default(''),technical:z.record(z.string().max(250)).default({}),interface:z.string().max(250).default(''),environment:z.string().max(500).default('')}).default({kind:'component',family:'',technical:{},interface:'',environment:''}),mode:z.enum(['guided','custom']).default('guided'),customFields:z.array(z.object({id:z.string().uuid(),label:z.string().max(100),value:z.string().max(2000)})).max(12).default([]),fields:z.object(textShape),destination:z.string().refine(c=>c===''||countryCodes.includes(c)),items:z.array(z.object({product:z.string().uuid().optional(),description:z.string().max(1000),quantity:z.string().max(20),unit:z.enum(['pcs','kg','m','m2','set'])})).min(1).max(50)});
export type Requirement=z.infer<typeof requirementSchema>;
export function emptyRequirement():Requirement{return {robotics:{kind:'component',family:'',technical:{},interface:'',environment:''},mode:'guided',customFields:[],fields:Object.fromEntries(requirementFields.map(f=>[f.key,''])) as Record<RequirementKey,string>,destination:'',items:[{description:'',quantity:'',unit:'pcs'}]};}
export function requirementIssues(d:Requirement,step:number,today:string,language:Language='en'):string[]{
 const issues:string[]=[];
 if((step===0&&d.mode==='custom'||step===2)&&d.customFields.some(f=>Boolean(f.label.trim())!==Boolean(f.value.trim())))issues.push('customFields');
 if(step===2&&Math.max(requirementDetails(d,'fr').length,requirementDetails(d,'en').length,requirementDetails(d,language).length)>10000)issues.push('detailsLimit');
 if(step===0){if(d.fields.title.trim().length<3)issues.push('title');if(d.fields.description.trim().length<20)issues.push('description');}
 if(step===1&&d.items.some(i=>!i.description.trim()||!/^\d+(?:[.,]\d+)?$/.test(i.quantity.replace(/[\s\u00a0\u202f]/g,''))||Number(i.quantity.replace(/[\s\u00a0\u202f]/g,'').replace(',','.'))<=0||Number(i.quantity.replace(/[\s\u00a0\u202f]/g,'').replace(',','.'))>1e12))issues.push('items');
 if(step===2){if(!countryCodes.includes(d.destination))issues.push('destination');for(const key of ['responseDate','deliveryDate'] as const)if(d.fields[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.fields[key])||Number.isNaN(Date.parse(d.fields[key]))||new Date(d.fields[key]).toISOString().slice(0,10)!==d.fields[key]||d.fields[key]<today))issues.push(key);if(d.fields.responseDate&&d.fields.deliveryDate&&d.fields.responseDate>d.fields.deliveryDate)issues.push('dateOrder');}
 return issues;
}
export function requirementDetails(d:Requirement,language:Language){
 const names=new Intl.DisplayNames([language],{type:'region'});
 const robotics=d.robotics;const family=roboticsFamilies.find(f=>f.id===robotics.family);const roboticsText=[translate(language,'Robotics requirement','Besoin robotique'),translate(language,robotics.kind==='robot'?'Complete robot':robotics.kind==='custom'?'Custom manufacturing':'Standard component',robotics.kind==='robot'?'Robot complet':robotics.kind==='custom'?'Fabrication sur mesure':'Composant standard'),family?translate(language,family.en,family.fr):'',...(roboticsMetrics[robotics.family]||[]).filter(m=>robotics.technical[m.key]).map(m=>`${translate(language,m.en,m.fr)} (${m.unit}) : ${robotics.technical[m.key]}`),robotics.interface?`${translate(language,'Interfaces / compatibility','Interfaces / compatibilité')} : ${robotics.interface}`:'',robotics.environment?`${translate(language,'Environment / constraints','Environnement / contraintes')} : ${robotics.environment}`:''].filter(Boolean).join('\n');
 return roboticsText+'\n\n'+requirementFields.filter(f=>f.key!=='title'&&d.fields[f.key].trim()).map(f=>{let value=d.fields[f.key];if('options'in f&&language!=='fr'){const n=f.options.indexOf(value as never);if(n>=0)value=translate(language,f.english[n],value);}return `${translate(language,f.en,f.fr)}\n${value}`}).join('\n\n')+'\n\n'+translate(language,'Delivery country','Pays de livraison')+'\n'+(d.destination?names.of(d.destination):'—')+d.customFields.filter(f=>f.label.trim()&&f.value.trim()).map(f=>'\n\n'+f.label.trim()+'\n'+f.value.trim()).join('');
}
export function requirementExport(d:Requirement,language:Language){return `${d.fields.title||'GSL Systems'}\n\n${requirementDetails(d,language)}\n\n${translate(language,'Requested items','Articles demandés')}\n${d.items.map((i,n)=>`${n+1}. ${i.description} — ${i.quantity} ${i.unit}`).join('\n')}\n\n${translate(language,'Private draft — not sent to suppliers.','Brouillon privé — aucun envoi à un fournisseur.')}`;}
