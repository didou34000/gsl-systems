/** Answers a buyer already gave, reused to pre-fill "Décrire mon besoin".
 *  Stored in this browser under a key that contains the signed-in user id, so one account never sees another's answers.
 *  Only fields that are still empty in the draft are filled; nothing typed by the person is overwritten. */
import {z} from 'zod';
import {countryCodes} from './onboarding/iso-countries';
import type {Requirement} from './requirement';

export type RequirementAccount={
 user:{id:string;email:string;name:string};
 signup:{name:string;country:string};
 organizations:{id:string;legal_name:string;country_code?:string;buyer:boolean;role:string;canRequest:boolean;canEnableBuyer:boolean}[];
};
export type BuyerCompanyAnswer={name:string;country:string};
const units=['pcs','kg','m','m2','set'] as const;
const short=(n:number)=>z.string().max(n).catch('');
export const defaultsSchema=z.object({
 version:z.literal(1).catch(1),
 organization:short(64),
 company:z.object({name:short(200),country:short(2)}).catch({name:'',country:''}),
 contact:z.object({name:short(160),email:short(254),phone:short(60)}).catch({name:'',email:'',phone:''}),
 delivery:z.object({destination:short(2),postalCode:short(32),city:short(250),address:short(400),transport:z.boolean().optional().catch(undefined),customs:z.boolean().optional().catch(undefined)}).catch({destination:'',postalCode:'',city:'',address:''}),
 unit:z.enum(units).optional().catch(undefined),
 frequency:short(40),
 packaging:short(500),
});
export type RequirementDefaults=z.infer<typeof defaultsSchema>;

export const defaultsKey=(userId:string)=>'gsl-requirement-defaults-v1:'+userId;
const validUser=(userId:string)=>/^[0-9a-f-]{36}$/i.test(userId);

export function readDefaults(userId:string,storage:Pick<Storage,'getItem'>|null=typeof localStorage==='undefined'?null:localStorage):RequirementDefaults|null{
 if(!validUser(userId)||!storage)return null;
 try{const raw=storage.getItem(defaultsKey(userId));if(!raw)return null;const parsed=defaultsSchema.safeParse(JSON.parse(raw));return parsed.success?parsed.data:null}catch{return null}
}
export function writeDefaults(userId:string,value:RequirementDefaults,storage:Pick<Storage,'setItem'>|null=typeof localStorage==='undefined'?null:localStorage){
 if(!validUser(userId)||!storage)return false;
 try{storage.setItem(defaultsKey(userId),JSON.stringify(value));return true}catch{return false}
}

/** What to remember after a successful save: reusable answers only, never the project itself. */
export function defaultsFromDraft(d:Requirement,organization:string,company:BuyerCompanyAnswer,previous:RequirementDefaults|null):RequirementDefaults{
 const units=d.items.map(i=>i.unit);const unit=units.length&&units.every(u=>u===units[0])?units[0]:previous?.unit;
 return {version:1,organization,company:{name:company.name.trim(),country:company.country},contact:{name:d.contact.name.trim(),email:d.contact.email.trim(),phone:d.contact.phone.trim()},
  delivery:{destination:d.destination,postalCode:d.logistics.postalCode.trim(),city:d.fields.city.trim(),address:d.logistics.address.trim(),transport:d.logistics.transport,customs:d.logistics.customs},
  unit,frequency:d.fields.frequency||previous?.frequency||'',packaging:d.fields.packaging.trim()||previous?.packaging||''};
}

const fill=(current:string,next:string|undefined)=>current.trim()?current:(next||'');
/** Fills empty draft fields from saved answers and from the account. Returns the same object when nothing changes. */
export function applyDefaults(d:Requirement,defaults:RequirementDefaults|null,account:RequirementAccount|null,untouched:boolean):Requirement{
 if(!defaults&&!account)return d;
 // A person's name is only taken from the profile when it is not the company name typed at sign-up.
 const profileName=account&&account.user.name&&account.user.name!==account.signup.name?account.user.name:'';
 const contact={name:fill(d.contact.name,defaults?.contact.name||profileName),email:fill(d.contact.email,defaults?.contact.email||account?.user.email),phone:fill(d.contact.phone,defaults?.contact.phone)};
 const deliveryEmpty=!d.destination&&!d.logistics.postalCode.trim()&&!d.fields.city.trim()&&!d.logistics.address.trim();
 const delivery=defaults&&deliveryEmpty?defaults.delivery:null;
 const destination=delivery&&countryCodes.includes(delivery.destination)?delivery.destination:d.destination;
 const next:Requirement={...d,contact,destination,
  logistics:delivery?{...d.logistics,postalCode:delivery.postalCode,address:delivery.address,...(untouched&&typeof delivery.transport==='boolean'?{transport:delivery.transport}:{}),...(untouched&&typeof delivery.customs==='boolean'?{customs:delivery.customs}:{})}:d.logistics,
  fields:{...d.fields,city:delivery?delivery.city:d.fields.city,frequency:fill(d.fields.frequency,defaults?.frequency),packaging:fill(d.fields.packaging,defaults?.packaging)},
  // The usual unit only applies to rows nobody has filled in yet.
  items:defaults?.unit?d.items.map(i=>!i.description.trim()&&!i.quantity.trim()&&i.unit==='pcs'?{...i,unit:defaults.unit!}:i):d.items};
 return JSON.stringify(next)===JSON.stringify(d)?d:next;
}

/** The company to propose when the account has none yet: last answer, then sign-up metadata, then the sign-up draft of this same account. */
export function proposedCompany(account:RequirementAccount,defaults:RequirementDefaults|null,signupDraft:string):BuyerCompanyAnswer{
 const valid=(c:string)=>countryCodes.includes(c)?c:'';
 if(defaults?.company.name)return {name:defaults.company.name,country:valid(defaults.company.country)};
 let draft:{name?:unknown;country?:unknown}={};try{draft=JSON.parse(signupDraft||'{}')}catch{}
 const draftName=typeof draft.name==='string'?draft.name.trim():'';const draftCountry=typeof draft.country==='string'?valid(draft.country):'';
 // The sign-up draft is not tied to an account in storage: only trust it when it matches what this account typed at sign-up.
 const sameAccount=draftName&&(draftName===account.signup.name||(!account.signup.name&&draftName===account.user.name));
 return {name:account.signup.name||(sameAccount?draftName:''),country:valid(account.signup.country)||(sameAccount?draftCountry:'')};
}
