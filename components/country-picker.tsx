'use client';
import {countryOptions} from '@/lib/country-names';
export default function CountryPicker({label,value,onChange,language,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;language:'en'|'fr';disabled?:boolean;neutral?:boolean}){
 return <label className="sw-field country-picker"><span>{label}</span><select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">{language==='fr'?'Choisir un pays':'Choose a country'}</option>{countryOptions(language).map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>;
}
