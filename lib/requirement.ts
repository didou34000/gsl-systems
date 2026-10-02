import {z} from 'zod';
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
export const requirementSchema=z.object({fields:z.object(textShape),destination:z.string().refine(c=>c===''||countryCodes.includes(c)),items:z.array(z.object({description:z.string().max(1000),quantity:z.string().max(20),unit:z.enum(['pcs','kg','m','m2','set'])})).min(1).max(50)});
export type Requirement=z.infer<typeof requirementSchema>;
export function emptyRequirement():Requirement{return {fields:Object.fromEntries(requirementFields.map(f=>[f.key,''])) as Record<RequirementKey,string>,destination:'',items:[{description:'',quantity:'',unit:'pcs'}]};}
export function requirementIssues(d:Requirement,step:number,today:string):string[]{
 const issues:string[]=[];
 if(step===0){if(d.fields.title.trim().length<3)issues.push('title');if(d.fields.description.trim().length<20)issues.push('description');}
 if(step===1&&d.items.some(i=>!i.description.trim()||!/^\d+(?:[.,]\d+)?$/.test(i.quantity.replace(/[\s\u00a0\u202f]/g,''))||Number(i.quantity.replace(/[\s\u00a0\u202f]/g,'').replace(',','.'))<=0||Number(i.quantity.replace(/[\s\u00a0\u202f]/g,'').replace(',','.'))>1e12))issues.push('items');
 if(step===2){if(!countryCodes.includes(d.destination))issues.push('destination');for(const key of ['responseDate','deliveryDate'] as const)if(d.fields[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.fields[key])||Number.isNaN(Date.parse(d.fields[key]))||new Date(d.fields[key]).toISOString().slice(0,10)!==d.fields[key]||d.fields[key]<today))issues.push(key);if(d.fields.responseDate&&d.fields.deliveryDate&&d.fields.responseDate>d.fields.deliveryDate)issues.push('dateOrder');}
 return issues;
}
export function requirementDetails(d:Requirement,language:'fr'|'en'){
 const names=new Intl.DisplayNames([language],{type:'region'});
 return requirementFields.filter(f=>f.key!=='title'&&d.fields[f.key].trim()).map(f=>{let value=d.fields[f.key];if('options'in f&&language==='en'){const n=f.options.indexOf(value as never);if(n>=0)value=f.english[n];}return `${f[language]}\n${value}`}).join('\n\n')+'\n\n'+(language==='fr'?'Pays de livraison':'Delivery country')+'\n'+(d.destination?names.of(d.destination):'—');
}
export function requirementExport(d:Requirement,language:'fr'|'en'){return `${d.fields.title||'GSL Systems'}\n\n${requirementDetails(d,language)}\n\n${language==='fr'?'Articles demandés':'Requested items'}\n${d.items.map((i,n)=>`${n+1}. ${i.description} — ${i.quantity} ${i.unit}`).join('\n')}\n\n${language==='fr'?'Brouillon privé — aucun envoi à un fournisseur.':'Private draft — not sent to suppliers.'}`;}
