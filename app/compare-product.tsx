'use client';
import {useState,useSyncExternalStore} from 'react';
import {useLanguage} from './language';
const key='cd-comparison';
const pattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function subscribe(change:()=>void){window.addEventListener('cd-compare',change);window.addEventListener('storage',change);return()=>{window.removeEventListener('cd-compare',change);window.removeEventListener('storage',change)}}
function snapshot(){try{return sessionStorage.getItem(key)||'[]'}catch{return '[]'}}
export function useComparison(){const raw=useSyncExternalStore(subscribe,snapshot,()=>null);let ids:string[]=[];try{const value=JSON.parse(raw||'[]');if(Array.isArray(value))ids=[...new Set(value.filter((id):id is string=>typeof id==='string'&&pattern.test(id)))].slice(0,3)}catch{}return {ids,ready:raw!==null};}
export function updateComparison(ids:string[]){sessionStorage.setItem(key,JSON.stringify(ids));window.dispatchEvent(new Event('cd-compare'));}
export function CompareProduct({id}:{id:string}){const {ids}=useComparison();const {l}=useLanguage();const [error,setError]=useState(false);const selected=ids.includes(id);return <span className="catalogue-compare-control"><label title={ids.length>=3&&!selected?l('Compare up to 3 products. Remove one to continue.','Vous pouvez comparer jusqu’à 3 produits. Retirez-en un pour continuer.'):undefined}><input type="checkbox" checked={selected} disabled={!selected&&ids.length>=3} onChange={()=>{try{updateComparison(selected?ids.filter(x=>x!==id):[...ids,id]);setError(false)}catch{setError(true)}}}/>{l('Compare','Comparer')}</label>{error&&<small role="alert">{l('Could not save. Please try again.','Enregistrement impossible. Réessayez.')}</small>}</span>}
