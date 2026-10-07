'use client';
import {useRouter} from 'next/navigation';
import {Globe2} from 'lucide-react';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {isLanguage,languageDirection,languageOptions,localizedHref,type Language} from '@/lib/i18n/languages';
import {translate} from '@/lib/i18n/translations';
export {languageOptions};
export type {Language};
const Context=createContext({language:'en' as Language,setLanguage:(_value:Language)=>{}});
export function LanguageProvider({children,initialLanguage='en'}:{children:ReactNode;initialLanguage?:Language}){
 const router=useRouter();const [language,setLanguage]=useState<Language>(initialLanguage);
 useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=languageDirection(language)},[language]);
 function change(value:Language){
  if(!isLanguage(value))return;
  setLanguage(value);
  document.cookie='gsl-language='+value+'; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
  window.history.replaceState(null,'',localizedHref(window.location.pathname+window.location.search+window.location.hash,value));
  router.refresh();try{localStorage.setItem('is-language',value)}catch{}
 }
 return <Context.Provider value={{language,setLanguage:change}}>{children}</Context.Provider>
}
export function useLanguage(){const context=useContext(Context);return {...context,l:(en:string,fr:string)=>translate(context.language,en,fr)}}
export function LanguageSelector(){const {language,setLanguage,l}=useLanguage();return <label className="language-selector"><Globe2 size={17} aria-hidden/><select aria-label={l('Language','Langue')} value={language} onChange={e=>{if(isLanguage(e.target.value))setLanguage(e.target.value)}}>{languageOptions.map(option=><option key={option.code} value={option.code} lang={option.code}>{option.name}</option>)}</select></label>}
