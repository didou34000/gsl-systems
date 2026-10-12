/** Registration journey shared by the sign-up, email confirmation and onboarding screens.
 *  Labels are English/French pairs resolved with l(); the other languages come from lib/i18n/onboarding.json. */
export type Purpose='buyer'|'supplier';
export const purposes:readonly Purpose[]=['buyer','supplier'];
export const isPurpose=(value:unknown):value is Purpose=>value==='buyer'||value==='supplier';

export const journeySteps:Record<Purpose,readonly (readonly [string,string])[]>={
 buyer:[['Your profile','Votre profil'],['Your details','Vos coordonnées'],['Email confirmation','Confirmation de l’email'],['Your company','Votre entreprise']],
 supplier:[['Your profile','Votre profil'],['Your details','Vos coordonnées'],['Email confirmation','Confirmation de l’email'],['Supplier profile','Fiche fournisseur']],
};

/** Session keys: the purpose and a draft of non-secret fields survive a reload. The password is never stored. */
export const purposeKey='gsl-signup-purpose';
export const draftKey='gsl-signup-draft';
export const buyerDraftKey='gsl-buyer-company-draft';

export function readStored(key:string,storage:'session'|'local'='session'):string{
 try{return (storage==='session'?sessionStorage:localStorage).getItem(key)||''}catch{return ''}
}
export function writeStored(key:string,value:string,storage:'session'|'local'='session'){
 try{const s=storage==='session'?sessionStorage:localStorage;if(value)s.setItem(key,value);else s.removeItem(key)}catch{}
}
export const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())&&value.trim().length<=254;
