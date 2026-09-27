import {z} from 'zod';
import {availableCountries} from './country-options';
import {assessCountryDetails} from './country-requirements';
const text=z.string().trim().max(250).default('');
const long=z.string().trim().max(5000).default('');
const date=z.string().refine(s=>!s||(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))),'DATE').default('');
const url=z.string().trim().max(500).refine(s=>!s||/^https?:\/\/[^\s]+$/i.test(s),'URL').default('');
export const countryCodes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const country=z.string().refine(c=>!c||countryCodes.includes(c),'COUNTRY').default('');
const address=z.object({line:text,city:text,region:text,postalCode:text,country});
const numeric=z.string().trim().max(30).refine(s=>!s||(/^\d+(\.\d+)?$/.test(s)&&Number(s)>0),'POSITIVE_NUMBER').default('');
export const productSchema=z.object({id:z.string().uuid(),name:text,reference:text,category:text,description:long,materials:text,processes:text,moq:numeric,unit:text,leadTime:text,origin:country,ce:z.enum(['unknown','required','not_applicable']).default('unknown'),ceReason:long,legislation:text,standards:text,documentId:text});
export const certificateSchema=z.object({id:z.string().uuid(),scope:z.enum(['management','product','test']),name:text,issuer:text,number:text,productId:text,coveredScope:long,issued:date,expires:date,notifiedBody:z.string().regex(/^(\d{4})?$/).default(''),verificationUrl:url,documentId:text});
export const supplierSchema=z.object({
 legalName:text,tradingName:text,country,entityKind:z.enum(['company','sole_trader','other']).default('company'),legalForm:text,identifiers:z.record(z.string().max(80),z.string().trim().max(250)).default({}),
 headquarters:address,publicAddress:z.enum(['city','exact']).default('city'),website:url,founded:z.string().regex(/^(\d{4})?$/).default(''),employees:text,activity:z.enum(['manufacturer','subcontractor','distributor','engineering']).default('manufacturer'),description:long,
 contact:z.object({name:text,role:text,email:z.string().trim().max(254).refine(s=>!s||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),'EMAIL').default(''),phone:text,languages:text,publish:z.boolean().default(false)}),
 sites:z.array(z.object({id:z.string().uuid(),name:text,address,relationship:z.enum(['owned','leased','partner']),area:numeric})).max(10).default([]),
 capabilities:z.object({sectors:text,processes:long,materials:long,equipment:long,tolerances:text,capacity:text,quality:long,subcontracting:long}),
 trade:z.object({markets:text,languages:text,currencies:text,incoterms:text,port:text,samples:z.enum(['yes','no','case_by_case']).default('case_by_case'),responseDays:numeric,packaging:long}),
 products:z.array(productSchema).max(30).default([]),certificates:z.array(certificateSchema).max(30).default([]),attestation:z.boolean().default(false),
});
export type SupplierProfile=z.infer<typeof supplierSchema>;
export type SupplierFile={id:string;kind:'logo'|'factory'|'product'|'registration'|'certificate'|'technical';name:string;url?:string;size:number;caption:string};
export const blankAddress=()=>({line:'',city:'',region:'',postalCode:'',country:''});
export function emptyProfile():SupplierProfile{return supplierSchema.parse({headquarters:blankAddress(),contact:{},capabilities:{},trade:{}})}
export const steps=[['Company','Entreprise'],['Production','Production'],['Products','Produits'],['Documents','Documents'],['Export & contact','Export et contact'],['Review & submit','Aperçu et envoi']];
export type ProfileIssue={step:number;path:string;en:string;fr:string};
export function profileIssues(p:SupplierProfile,files:SupplierFile[],today=new Date().toISOString().slice(0,10)):ProfileIssue[]{
 const out:ProfileIssue[]=[];const need=(ok:unknown,step:number,path:string,en:string,fr:string)=>{if(!ok)out.push({step,path,en,fr})};
 need(p.legalName.length>=2,0,'legalName','Enter the registered company name.','Renseignez la raison sociale.');
 need(p.country&&availableCountries.includes(p.country),0,'country','Choose one of the countries currently open for registration.','Choisissez un pays ouvert aux inscriptions pour le moment.');
 need(p.website,0,'website','Add your company website or a verifiable professional profile URL.','Ajoutez le site de l’entreprise ou l’URL d’un profil professionnel vérifiable.');
 need(p.legalForm,0,'legalForm','Enter the legal form.','Indiquez la forme juridique.');
 need(p.headquarters.line&&p.headquarters.city,0,'headquarters','Complete the registered office address.','Complétez l’adresse du siège social.');
 need(p.description.length>=100,0,'description','Describe the business in at least 100 characters.','Décrivez l’activité en au moins 100 caractères.');
 if(p.country){const a=assessCountryDetails(p.country,p.entityKind,p.identifiers);need(a.complete,0,'identifiers','Complete the identifiers required for this country.','Complétez les identifiants demandés pour ce pays.');}
 need(p.capabilities.processes&&p.capabilities.materials&&p.capabilities.quality,1,'capabilities','Describe processes, materials and quality control.','Décrivez les procédés, matières et contrôles qualité.');
 if(['manufacturer','subcontractor'].includes(p.activity))need(p.sites.length>0,1,'sites','Add at least one production site.','Ajoutez au moins un site de production.');
 p.sites.forEach((s,i)=>need(s.name&&s.address.line&&s.address.city&&s.address.country,1,`sites.${i}`,'Complete each production site address.','Complétez l’adresse de chaque site de production.'));
 need(p.products.length,2,'products','Add a product or manufacturing service.','Ajoutez un produit ou une prestation de fabrication.');
 p.products.forEach((v,i)=>{need(v.name&&v.reference&&v.category&&v.description.length>=60&&v.origin,2,`products.${i}`,'Complete each offer: title, reference, category, description (60 characters) and origin.','Complétez chaque offre : titre, référence, catégorie, description (60 caractères) et origine.');need(!v.moq||v.unit,2,`products.${i}.unit`,'Specify the unit for your minimum order.','Précisez l’unité de la quantité minimale.');need(v.ce!=='not_applicable'||v.ceReason,2,`products.${i}.ceReason`,'Explain why CE marking does not apply.','Expliquez pourquoi le marquage CE ne s’applique pas.');if(v.ce==='required'){need(v.legislation&&v.documentId&&files.some(f=>f.id===v.documentId&&f.kind==='technical'),2,`products.${i}.ce`,'For CE products, identify applicable legislation and attach the corresponding declaration.','Pour un produit soumis au CE, indiquez les textes applicables et joignez la déclaration correspondante.');}});
 need(files.some(f=>f.kind==='registration'),3,'registration','Attach official registration evidence.','Joignez un justificatif officiel d’immatriculation.');
 need(files.some(f=>f.kind==='logo'),3,'logo','Add your company logo.','Ajoutez le logo de votre entreprise.');
 p.certificates.forEach((c,i)=>{need(c.name&&c.issuer&&c.number&&c.coveredScope&&c.documentId&&files.some(f=>f.id===c.documentId&&f.kind==='certificate'),3,`certificates.${i}`,'Complete each certificate and attach its evidence.','Complétez chaque certificat et joignez son justificatif.');need(c.scope==='management'||p.products.some(v=>v.id===c.productId),3,`certificates.${i}.productId`,'Link the certificate or test report to a listed product.','Reliez le certificat ou rapport d’essai à un produit.');need(!c.expires||c.expires>=today,3,`certificates.${i}.expires`,'Remove or replace expired certificates.','Retirez ou remplacez les certificats expirés.');need(!c.issued||c.issued<=today,3,`certificates.${i}.issued`,'Check the certificate issue date.','Vérifiez la date d’émission du certificat.');need(!c.issued||!c.expires||c.expires>=c.issued,3,`certificates.${i}.dates`,'Check certificate dates.','Vérifiez les dates du certificat.');});
 need(p.contact.name&&p.contact.role&&p.contact.email,4,'contact','Enter a contact name, role and email.','Indiquez le nom, la fonction et l’email du contact.');
 need(p.trade.markets&&p.contact.languages,4,'trade','Specify delivery markets and contact languages.','Précisez les marchés livrés et les langues du contact.');
 need(p.attestation,5,'attestation','Confirm that you are authorised to submit this company profile.','Confirmez que vous êtes habilité à soumettre ce dossier.');
 return out;
}
