import {z} from 'zod';
import {availableCountries} from './country-options';
import {assessCountryDetails} from './country-requirements';
const text=z.string().trim().max(250).default('');
const long=z.string().trim().max(5000).default('');
const date=z.string().refine(s=>!s||(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s),'DATE').default('');
const url=z.string().trim().max(500).refine(s=>!s||/^https?:\/\/[^\s]+$/i.test(s),'URL').default('');
export {countryCodes} from './iso-countries';
import {countryCodes} from './iso-countries';
const country=z.string().refine(c=>!c||countryCodes.includes(c),'COUNTRY').default('');
const address=z.object({line:text,city:text,region:text,postalCode:text,country});
const numeric=z.string().trim().max(30).transform(s=>s.replace(/[\s\u00a0\u202f]/g,'').replace(',','.')).refine(s=>!s||(/^\d+(\.\d+)?$/.test(s)&&Number(s)>0),'POSITIVE_NUMBER').default('');
export function normalizeProductCategory(value:string){return ({machining:'metal',machinery:'machines',electrical:'electricite',plastics:'plasturgie',textiles:'textile',packaging:'emballage'} as Record<string,string>)[value]||value;}
export const productSchema=z.object({id:z.string().uuid(),name:text,reference:text,category:text.transform(normalizeProductCategory),description:long,materials:text,processes:text,moq:numeric,unit:text,leadTime:text,origin:country,ce:z.enum(['unknown','required','not_applicable']).default('unknown'),ceReason:long,legislation:text,standards:text,documentId:text});
export const certificateSchema=z.object({id:z.string().uuid(),scope:z.enum(['management','product','test']),name:text,issuer:text,number:text,productId:text,coveredScope:long,issued:date,expires:date,notifiedBody:z.string().regex(/^(\d{4})?$/).default(''),verificationUrl:url,documentId:text});
export const supplierSchema=z.object({
 countryRulesVersion:text,legalName:text,tradingName:text,country,entityKind:z.enum(['company','sole_trader','other']).default('company'),legalForm:text,identifiers:z.record(z.string().max(80),z.string().trim().max(250)).default({}),
 headquarters:address,publicAddress:z.enum(['city','exact']).default('city'),website:url,founded:z.string().regex(/^(\d{4})?$/).default(''),employees:text,activity:z.enum(['','manufacturer','subcontractor','distributor','intermediary','engineering']).default(''),description:long,
 contact:z.object({name:text,role:text,email:z.string().trim().max(254).refine(s=>!s||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),'EMAIL').default(''),phone:text,phoneCountry:country,phoneE164:text,languages:text,publish:z.boolean().default(false)}),
 sites:z.array(z.object({id:z.string().uuid(),name:text,address,relationship:z.enum(['owned','leased','partner']),area:numeric})).max(10).default([]),
 capabilities:z.object({sectors:text,processes:long,materials:long,equipment:long,tolerances:text,capacity:text,quality:long,subcontracting:long}),
 trade:z.object({markets:text,languages:text,currencies:text,incoterms:text,port:text,samples:z.enum(['yes','no','case_by_case']).default('case_by_case'),responseDays:numeric,packaging:long}),
 products:z.array(productSchema).max(30).default([]),certificates:z.array(certificateSchema).max(30).default([]),attestation:z.boolean().default(false),
});
export type SupplierProfile=z.infer<typeof supplierSchema>;
export type SupplierFile={id:string;kind:'logo'|'factory'|'product'|'registration'|'certificate'|'technical';name:string;url?:string;size:number;caption:string};
export const blankAddress=()=>({line:'',city:'',region:'',postalCode:'',country:''});
export function emptyProfile():SupplierProfile{return supplierSchema.parse({headquarters:blankAddress(),contact:{},capabilities:{},trade:{}})}
export const steps=[['Company','Entreprise'],['Capabilities','Capacités'],['Products','Produits'],['Documents','Documents'],['Validation','Validation']];
export type ProfileIssue={step:number;path:string;en:string;fr:string};
export function profileIssues(p:SupplierProfile,files:SupplierFile[],today=new Date().toISOString().slice(0,10)):ProfileIssue[]{
 const out:ProfileIssue[]=[];const need=(ok:unknown,step:number,path:string,en:string,fr:string)=>{if(!ok)out.push({step,path,en,fr})};
 need(p.activity,0,'activity','Choose your business activity.','Choisissez votre type d’activité.');
 need(p.legalName.length>=2,0,'legalName','Enter the registered company name.','Renseignez la raison sociale.');
 need(p.country&&availableCountries.includes(p.country),0,'country','Choose the registration country.','Choisissez le pays d’immatriculation.');

 need(p.legalForm,0,'legalForm','Enter the legal form.','Indiquez la forme juridique.');
 need(p.headquarters.line&&p.headquarters.city,0,'headquarters','Complete the registered office address.','Complétez l’adresse du siège social.');
 need(p.description.length>=30,0,'description','Describe the business in at least 30 characters.','Décrivez l’activité en au moins 30 caractères.');
 if(p.country){const a=assessCountryDetails(p.country,p.entityKind,p.identifiers);need(a.complete,0,'identifiers','Complete the identifiers required for this country.','Complétez les identifiants demandés pour ce pays.');}
 if(['manufacturer','subcontractor'].includes(p.activity))need(p.capabilities.processes&&p.capabilities.materials&&p.capabilities.quality,1,'capabilities','Describe processes, materials and quality control.','Décrivez les procédés, matières et contrôles qualité.');
 if(['manufacturer','subcontractor'].includes(p.activity))need(p.sites.length>0,1,'sites','Add at least one production site.','Ajoutez au moins un site de production.');
 p.sites.forEach((s,i)=>need(s.name&&s.address.line&&s.address.city&&s.address.country,1,`sites.${i}`,'Complete each production site address.','Complétez l’adresse de chaque site de production.'));
 need(p.products.length,2,'products','Add a product or manufacturing service.','Ajoutez un produit ou une prestation de fabrication.');
 p.products.forEach((v,i)=>{need(v.name&&v.category&&v.description.length>=30&&v.origin,2,`products.${i}`,'Complete each offer: title, category, description (30 characters) and manufacturing country.','Complétez chaque offre : titre, catégorie, description (30 caractères) et pays de fabrication.');need(!v.moq||v.unit,2,`products.${i}.unit`,'Specify the unit for your minimum order.','Précisez l’unité de la quantité minimale.');need(v.ce!=='not_applicable'||v.ceReason,2,`products.${i}.ceReason`,'Explain why CE marking does not apply.','Expliquez pourquoi le marquage CE ne s’applique pas.');if(v.ce==='required'){need(v.legislation&&v.documentId&&files.some(f=>f.id===v.documentId&&f.kind==='technical'),2,`products.${i}.ce`,'For CE products, identify applicable legislation and attach the corresponding declaration.','Pour un produit soumis au CE, indiquez les textes applicables et joignez la déclaration correspondante.');}});
 need(files.some(f=>f.kind==='registration')||(p.identifiers.registration_explanation||'').trim().length>=20,3,'registration','Attach official registration evidence.','Joignez un justificatif officiel d’immatriculation.');

 p.certificates.forEach((c,i)=>{need(c.name&&c.issuer&&c.number&&c.coveredScope&&c.documentId&&files.some(f=>f.id===c.documentId&&f.kind==='certificate'),3,`certificates.${i}`,'Complete each certificate and attach its evidence.','Complétez chaque certificat et joignez son justificatif.');need(c.scope==='management'||p.products.some(v=>v.id===c.productId),3,`certificates.${i}.productId`,'Link the certificate or test report to a listed product.','Reliez le certificat ou rapport d’essai à un produit.');need(!c.issued||c.issued<=today,3,`certificates.${i}.issued`,'Check the certificate issue date.','Vérifiez la date d’émission du certificat.');need(!c.issued||!c.expires||c.expires>=c.issued,3,`certificates.${i}.dates`,'Check certificate dates.','Vérifiez les dates du certificat.');});
 need(p.contact.name&&p.contact.role&&p.contact.email,4,'contact','Enter a contact name, role and email.','Indiquez le nom, la fonction et l’email du contact.');
 need(p.trade.markets&&p.contact.languages,4,'trade','Specify delivery markets and contact languages.','Précisez les marchés livrés et les langues du contact.');
 need(p.attestation,5,'attestation','Confirm that you are authorised to submit this company profile.','Confirmez que vous êtes habilité à soumettre ce dossier.');
 return out.map(issue=>({...issue,step:Math.min(issue.step,4)}));
}

// Drafts retain partial strings, but never accept unknown properties or unbounded input.
function draftShape(schema:z.ZodTypeAny,key=''):z.ZodTypeAny {
 if(schema instanceof z.ZodDefault)return draftShape(schema._def.innerType,key).default(schema._def.defaultValue);
 if(schema instanceof z.ZodEffects)return draftShape(schema._def.schema,key);
 if(schema instanceof z.ZodObject)return z.object(Object.fromEntries(Object.entries(schema.shape).map(([k,v])=>[k,draftShape(v as z.ZodTypeAny,k)]))).strict();
 if(schema instanceof z.ZodArray)return z.array(draftShape(schema.element)).max(schema._def.maxLength?.value??30);
 if(schema instanceof z.ZodString&&key!=='id'){
  const max=schema._def.checks.find(c=>c.kind==='max');return z.string().max(max&&'value' in max?max.value:5000);
 }
 return schema;
}
export const supplierDraftSchema=draftShape(supplierSchema) as z.ZodType<SupplierProfile>;

/** Explicit destinations for strict validation failures; drafts remain permissive. */
export function supplierValidationIssues(profile:SupplierProfile):ProfileIssue[]{
 const result=supplierSchema.safeParse(profile);if(result.success)return [];
 const labels:Record<string,[string,string]>={website:['Website (https://…)','Site internet (https://…)'],founded:['Year founded','Année de création'],email:['Email address','Adresse email'],phoneCountry:['Phone country','Pays du téléphone'],moq:['Minimum order quantity','Quantité minimale'],area:['Surface area','Surface'],responseDays:['Response time','Délai de réponse'],issued:['Issue date','Date d’émission'],expires:['Expiry date','Date d’expiration'],verificationUrl:['Verification URL','Lien de vérification'],notifiedBody:['Notified body number','Numéro d’organisme notifié'],origin:['Country of manufacture','Pays de fabrication'],country:['Country','Pays']};
 return result.error.issues.map(i=>{const root=String(i.path[0]),leaf=String(i.path.at(-1)),label=labels[leaf]||[leaf,leaf],index=typeof i.path[1]==='number'?` ${Number(i.path[1])+1}`:'';const section=root==='products'?['Product','Produit']:root==='sites'?['Site','Site']:root==='certificates'?['Certificate','Certificat']:['',''];return {path:i.path.join('.'),step:root==='products'?2:root==='sites'||root==='capabilities'?1:root==='certificates'?3:['contact','trade'].includes(root)?4:0,en:`${section[0]}${index}${section[0]?' — ':''}${label[0]}: check the format or length.`,fr:`${section[1]}${index}${section[1]?' — ':''}${label[1]} : vérifiez le format ou la longueur.`};});
}
