'use client';
import {useEffect,useId,useState} from 'react';
import {legalFormsFor,legalFormValue,type LegalForm} from '@/lib/onboarding/legal-forms';

/** Free-text legal form field with the local forms of the chosen country as suggestions. */
export default function LegalFormInput({country,value,onChange,disabled,name='legalForm',...rest}:{country:string;value:string;onChange:(value:string)=>void;disabled?:boolean;name?:string}&Omit<React.InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'list'|'name'>){
 const list=useId();const [forms,setForms]=useState<{country:string;forms:LegalForm[]}>({country:'',forms:[]});
 useEffect(()=>{let active=true;legalFormsFor(country).then(f=>{if(active)setForms({country,forms:f})}).catch(()=>{if(active)setForms({country,forms:[]})});return()=>{active=false}},[country]);
 const shown=forms.country===country?forms.forms:[];
 return <><input {...rest} name={name} list={shown.length?list:undefined} autoComplete="off" maxLength={120} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}/>
  {shown.length>0&&<datalist id={list}>{shown.map(f=><option key={legalFormValue(f)} value={legalFormValue(f)}>{f.transliteration||undefined}</option>)}</datalist>}</>;
}
