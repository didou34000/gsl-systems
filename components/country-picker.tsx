'use client';
import type {Language} from '@/lib/i18n/languages';
import {translate} from '@/lib/i18n/translations';
import {isSourcingCountry} from '@/lib/sourcing-coverage';
import {countryOptions} from '@/lib/country-names';
export default function CountryPicker({label,value,onChange,language,disabled=false,scope='world'}:{label:string;value:string;onChange:(value:string)=>void;language:Language;disabled?:boolean;neutral?:boolean;scope?:'world'|'sourcing'}){
 return <label className="sw-field country-picker"><span>{label}</span><select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">{translate(language,'Choose a country','Choisir un pays')}</option>{value&&scope==='sourcing'&&!isSourcingCountry(value)&&<option value={value} disabled>{value} — {translate(language,'Outside our current scope','Hors périmètre actuel')}</option>}{countryOptions(language).filter(c=>scope==='world'||isSourcingCountry(c.code)).map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>;
}
