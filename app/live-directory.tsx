'use client';
import {useLanguage} from './language';
import {useEffect,useState} from 'react';
import RoboticsFamilies from './robotics-families';
import SourcingNetwork from './sourcing-network';
export default function LiveDirectory({kind}:{kind:'sectors'|'countries'}) {
 const {l}=useLanguage();const [counts,setCounts]=useState<Record<string,number>|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const c=new AbortController();fetch('/api/platform?view=catalogue',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<{families:Record<string,number>;products:{product_id:string;name:string;category:string}[]}>}).then(d=>setCounts(d.families||{})).catch(e=>{if(e.name!=='AbortError')setError(true)});return()=>c.abort()},[]);
 if(kind==='countries')return <main><SourcingNetwork/></main>;
 return <main>{counts?<RoboticsFamilies counts={counts}/>:<div className="container catalogue-page" role={error?'alert':'status'}>{error?l('Catalogue temporarily unavailable','Catalogue momentanément indisponible'):l('Loading component families…','Chargement des familles de composants…')}</div>}</main>;
}
