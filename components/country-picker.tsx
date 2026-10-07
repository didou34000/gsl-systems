'use client';
import type {Language} from '@/lib/i18n/languages';
import {translate} from '@/lib/i18n/translations';
import {countryOptions} from '@/lib/country-names';
export default function CountryPicker({label,value,onChange,language,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;language:Language;disabled?:boolean;neutral?:boolean}){
 return <label className="sw-field country-picker"><span>{label}</span><select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">{translate(language,'Choose a country','Choisir un pays')}</option>{countryOptions(language).map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>;
}
