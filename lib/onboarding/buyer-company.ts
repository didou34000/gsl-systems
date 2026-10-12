import {countryCodes} from './iso-countries';

/** Questions asked to a purchasing company after email confirmation.
 *  Each entry maps to one argument of the existing `buyer_company` workflow command.
 *  To add a question: add an entry here, then store it server side (the command currently accepts name and country only). */
export type BuyerField={key:'name'|'country';label:readonly [string,string];hint:readonly [string,string];kind:'text'|'country';required:boolean;min?:number;max?:number;autoComplete?:string};
export const buyerCompanyFields:readonly BuyerField[]=[
 {key:'name',kind:'text',required:true,min:2,max:160,autoComplete:'organization',label:['Company name','Nom de l’entreprise'],hint:['As it appears on your invoices.','Tel qu’il figure sur vos factures.']},
 {key:'country',kind:'country',required:true,label:['Registration country','Pays d’immatriculation'],hint:['Where your company is registered. Manufacturers see this country.','Là où votre entreprise est immatriculée. Les fabricants voient ce pays.']},
];
export type BuyerCompany=Record<BuyerField['key'],string>;
export const emptyBuyerCompany=():BuyerCompany=>({name:'',country:''});

/** Returns the English/French message for the first problem of a field, or null. */
export function buyerFieldIssue(field:BuyerField,value:string):readonly [string,string]|null{
 const v=value.trim();
 if(field.required&&!v)return field.kind==='country'?['Choose a country.','Choisissez un pays.']:['This field is required.','Ce champ est obligatoire.'];
 if(field.kind==='country'&&v&&!countryCodes.includes(v))return ['Choose a country from the list.','Choisissez un pays dans la liste.'];
 if(field.kind==='text'&&v&&field.min&&v.length<field.min)return ['Enter at least 2 characters.','Saisissez au moins 2 caractères.'];
 if(field.kind==='text'&&field.max&&v.length>field.max)return ['This text is too long.','Ce texte est trop long.'];
 return null;
}
export const buyerCompanyIssues=(company:BuyerCompany)=>buyerCompanyFields.map(f=>[f.key,buyerFieldIssue(f,company[f.key])] as const).filter(([,issue])=>issue);
