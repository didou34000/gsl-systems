'use client';
import {useEffect,useState} from 'react';
import RoboticsFamilies from './robotics-families';
import SourcingNetwork from './sourcing-network';
export default function LiveDirectory({kind}:{kind:'sectors'|'countries'}) {
 const [counts,setCounts]=useState<Record<string,number>|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const c=new AbortController();fetch('/api/platform?view=catalogue',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<{families:Record<string,number>;products:{product_id:string;name:string;category:string}[]}>}).then(d=>setCounts(d.families||{})).catch(e=>{if(e.name!=='AbortError')setError(true)});return()=>c.abort()},[]);
 if(kind==='countries')return <main><SourcingNetwork/></main>;
 // The families are static: show them while counts load, and without counts if the catalogue is unreachable.
 return <main><RoboticsFamilies counts={counts||undefined} status={counts?'ready':error?'unavailable':'loading'}/></main>;
}
