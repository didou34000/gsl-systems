import extra from './extra.json';
import countryRequirements from './country-requirements.json';
import requirements from './requirements.json';
import supplier from './supplier.json';
import offers from './offers.json';
import publicCopy from './public.json';
import operations from './operations.json';
import account from './account.json';
import messages from './messages.json';
import auth from './auth.json';
import core from './core.json';
import catalogue from './catalogue.json';
import sourcing from './sourcing.json';
import workspace from './workspace.json';
import onboarding from './onboarding.json';
import countries from './countries.json';
import robotics from './robotics.json';
import humanoid from './humanoid.json';
import referenced from './referenced.json';
import home from './home.json';
import coreAdditions from './core-additions.json';
import supplierProducts from './supplier-products.json';
import requestBoard from './request-board.json';
import type {Language} from './languages';
// English keys keep existing l(English, French) call sites compatible.
// Untranslated technical/editorial copy explicitly falls back to English.
// Supplier-authored content never passes through this dictionary.
type AdditionalLanguage=Exclude<Language,'en'|'fr'>;
export type TranslationRow = readonly [string,string,string,string,string,string,string,string];
export const translationLanguages=['es','pt','de','it','tr','ar','hi','zh'] as const;
export const translations:Record<string,readonly string[]>={...requestBoard,...supplierProducts,...core,...catalogue,...sourcing,...auth,...messages,...account,...operations,...offers,...publicCopy,...requirements,...supplier,...extra,...countryRequirements,...workspace,...onboarding,...countries,...robotics,...humanoid,...referenced,...home,...coreAdditions};
export function translate(language:Language,english:string,french:string=english){
 if(language==='fr')return french;
 if(language==='en')return english;
 const index=translationLanguages.indexOf(language as AdditionalLanguage);
 const exact=translations[english]?.[index];
 if(exact)return exact;
 // These two accessible labels are generated from an ordinal, never from user content.
 const photo=english.match(/^(Company photo|Remove photo) (\d+)$/);
 if(photo){const template=translations[photo[1]+' {number}']?.[index];if(template)return template.replace('{number}',photo[2]);}
 // Validation messages are composed from fixed schema labels and a row number.
 const issue=english.match(/^(?:(Product|Site|Certificate)( \d+)?, )?(.+): check the format or length\.$/);
 if(issue){
  const suffix=translations['check the format or length.']?.[index];
  const label=translations[issue[3]]?.[index];
  const section=issue[1]?translations[issue[1]]?.[index]:'';
  if(suffix&&label&&(!issue[1]||section))return `${section?section+(issue[2]||'')+', ':''}${label}: ${suffix}`;
 }
 return english;
}
