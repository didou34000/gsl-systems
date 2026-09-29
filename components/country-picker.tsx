'use client';
import {useRef,useState} from 'react';
import {ChevronDown,Check} from 'lucide-react';
import CountryFlag from './country-flag';
import {countryGroups,availableCountries} from '@/lib/onboarding/country-options';
export default function CountryPicker({label,value,onChange,language,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;language:'en'|'fr';disabled?:boolean}){
 const [search,setSearch]=useState('');
 const ref=useRef<HTMLDetailsElement>(null);const names=new Intl.DisplayNames([language],{type:'region'});
 const choose=(v:string)=>{onChange(v);if(ref.current)ref.current.open=false};
 return <div className="sw-field country-picker"><span>{label}</span><details ref={ref} onKeyDown={e=>{if(e.key==='Escape'&&ref.current){ref.current.open=false;ref.current.querySelector('summary')?.focus()}}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)&&ref.current)ref.current.open=false}}><summary aria-label={label} aria-disabled={disabled} onClick={e=>{if(disabled)e.preventDefault()}}><CountryFlag code={value}/><span>{value?names.of(value):(language==='fr'?'Choisir un pays':'Choose a country')}</span><ChevronDown size={16}/></summary>{!disabled&&<div className="country-options"><input aria-label={language==='fr'?'Rechercher un pays':'Search countries'} value={search} onChange={e=>setSearch(e.target.value)} placeholder={language==='fr'?'Rechercher un pays':'Search countries'}/><button type="button" onClick={()=>choose('')}>{language==='fr'?'Aucun pays sélectionné':'No country selected'}</button>{value&&!availableCountries.includes(value)&&<p className="country-legacy">{names.of(value)} · {language==='fr'?'ancien choix conservé':'previous selection retained'}</p>}{countryGroups.map(g=><section key={g.en}><h4>{g[language]}</h4>{g.codes.filter(code=>(names.of(code)||code).toLocaleLowerCase().includes(search.toLocaleLowerCase())||code.toLowerCase()===search.toLowerCase()).map(code=><button type="button" key={code} aria-pressed={value===code} onClick={()=>choose(code)}><CountryFlag code={code}/><span>{names.of(code)}</span>{value===code&&<Check size={15}/>}</button>)}</section>)}</div>}</details></div>
}
