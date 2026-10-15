'use client';
import './address-autocomplete.css';
import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import type {Language} from '@/lib/i18n/languages';
import {translate} from '@/lib/i18n/translations';
import {geocodeAttribution,geocodeMinLength,type AddressSuggestion} from '@/lib/geocode';
export type {AddressSuggestion};

type Props={label:string;value:string;onChange:(value:string)=>void;onSelect:(suggestion:AddressSuggestion)=>void;language:Language;country?:string;maxLength?:number;disabled?:boolean;required?:boolean;name?:string;autoComplete?:string;hint?:string};

/** A text field with worldwide address suggestions (OpenStreetMap through /api/geocode).
 *  It always remains a plain text input: when the service is slow or unavailable, the typed value is kept as is.
 *  WAI-ARIA 1.2 combobox: arrows move through suggestions, Enter selects, Escape closes. */
export default function AddressAutocomplete({label,value,onChange,onSelect,language,country='',maxLength=400,disabled=false,required=false,name,autoComplete='street-address',hint}:Props){
 const t=(en:string,fr:string)=>translate(language,en,fr);
 const id=useId();const listId=id+'-list';const hintId=id+'-hint';
 const [items,setItems]=useState<AddressSuggestion[]>([]),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[loading,setLoading]=useState(false);
 const typed=useRef(false);const pausedUntil=useRef(0);const blurTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const query=value.trim();

 useEffect(()=>{
  // Only search for what the person typed, never for a restored or selected value.
  if(!typed.current||query.length<geocodeMinLength||Date.now()<pausedUntil.current){setLoading(false);if(query.length<geocodeMinLength){setItems([]);setOpen(false)}return}
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);
   try{
    const params=new URLSearchParams({q:query,lang:language});if(country)params.set('country',country);
    const response=await fetch('/api/geocode?'+params,{signal:controller.signal});
    if(response.status===429||response.status>=500){pausedUntil.current=Date.now()+60000;throw Error('UNAVAILABLE')}
    if(!response.ok)throw Error('INVALID');
    const body=await response.json() as {results?:AddressSuggestion[]};
    const results=Array.isArray(body.results)?body.results.slice(0,5):[];
    setItems(results);setActive(-1);setOpen(results.length>0);
   }catch(error){if((error as Error).name!=='AbortError'){setItems([]);setOpen(false)}}
   finally{if(!controller.signal.aborted)setLoading(false)}
  },350);
  return()=>{clearTimeout(timer);controller.abort()};
 },[query,country,language]);

 function choose(item:AddressSuggestion){typed.current=false;setOpen(false);setItems([]);setActive(-1);onSelect(item)}
 function keyDown(e:KeyboardEvent<HTMLInputElement>){
  if(e.key==='ArrowDown'){if(!items.length)return;e.preventDefault();setOpen(true);setActive(i=>(i+1)%items.length)}
  else if(e.key==='ArrowUp'){if(!items.length)return;e.preventDefault();setOpen(true);setActive(i=>i<=0?items.length-1:i-1)}
  else if(e.key==='Enter'){if(open&&active>=0&&items[active]){e.preventDefault();choose(items[active])}}
  else if(e.key==='Escape'){if(open){e.preventDefault();setOpen(false);setActive(-1)}}
  else if(e.key==='Tab'){setOpen(false)}
 }
 const expanded=open&&items.length>0;
 return <div className="address-autocomplete">
  <label htmlFor={id}>{label}{required?' *':''}</label>
  <div className="address-autocomplete-box">
   <input id={id} name={name} type="text" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId} aria-activedescendant={expanded&&active>=0?`${id}-option-${active}`:undefined} aria-describedby={hintId} autoComplete={autoComplete} maxLength={maxLength} required={required} disabled={disabled} value={value}
    onChange={e=>{typed.current=true;onChange(e.target.value)}} onKeyDown={keyDown} onFocus={()=>{if(items.length)setOpen(true)}} onBlur={()=>{blurTimer.current=setTimeout(()=>setOpen(false),120)}}/>
   {expanded&&<div className="address-autocomplete-popup">
    <ul id={listId} role="listbox" aria-label={label}>
     {items.map((item,index)=><li key={item.id} id={`${id}-option-${index}`} role="option" aria-selected={index===active} className={index===active?'active':''}
      onMouseDown={e=>{e.preventDefault();clearTimeout(blurTimer.current)}} onClick={()=>choose(item)} onMouseEnter={()=>setActive(index)}>
      <span>{item.line||item.city||item.label}</span><small>{[item.line?[item.postalCode,item.city].filter(Boolean).join(' '):item.postalCode,item.country].filter(Boolean).join(', ')}</small>
     </li>)}
    </ul>
    <p className="address-autocomplete-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{geocodeAttribution}</a></p>
   </div>}
  </div>
  <small id={hintId} className="address-autocomplete-hint">{hint||t('Type at least 3 characters to see suggestions, or enter the address freely.','Saisissez au moins 3 caractères pour voir des suggestions, ou écrivez l’adresse librement.')}</small>
  <span className="address-autocomplete-status" role="status" aria-live="polite">{loading?t('Searching addresses…','Recherche d’adresses…'):expanded?items.length+' '+t('suggestions available. Use the arrow keys to choose one.','suggestions disponibles. Utilisez les flèches pour en choisir une.'):''}</span>
 </div>;
}
