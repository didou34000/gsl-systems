'use client';
import {useRouter} from 'next/navigation';
import CountryFlag from '@/components/country-flag';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
export type Language='en'|'fr';
const Context=createContext({language:'en' as Language,setLanguage:(_value:Language)=>{}});
export function LanguageProvider({children,initialLanguage='en'}:{children:ReactNode;initialLanguage?:Language}){const router=useRouter();const [language,setLanguage]=useState<Language>(initialLanguage);useEffect(()=>{document.documentElement.lang=language},[language]);function change(value:Language){setLanguage(value);document.cookie='gsl-language='+value+'; Path=/; Max-Age=31536000; SameSite=Lax';const url=new URL(window.location.href);if(value==='fr')url.searchParams.set('lang','fr');else url.searchParams.delete('lang');window.history.replaceState(null,'',url);router.refresh();try{localStorage.setItem('is-language',value)}catch{}}return <Context.Provider value={{language,setLanguage:change}}>{children}</Context.Provider>}
export function useLanguage(){const context=useContext(Context);return {...context,l:(en:string,fr:string)=>context.language==='en'?en:fr}}
export function LanguageSelector(){const {language,setLanguage}=useLanguage();return <label className="language-selector"><CountryFlag code={language==='en'?'GB':'FR'}/><select aria-label="Language / Langue" value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="en">EN · English</option><option value="fr">FR · Français</option></select></label>}
