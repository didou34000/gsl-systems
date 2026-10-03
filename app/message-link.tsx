'use client';
import {useEffect,useState} from 'react';
import {MessageSquare} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';
export default function MessageLink(){
 const {l}=useLanguage();const [count,setCount]=useState(0);
 useEffect(()=>{const c=new AbortController();let running=false;async function refresh(){if(running||document.visibilityState!=='visible')return;running=true;try{const r=await fetch('/api/messaging?unread=1',{cache:'no-store',signal:c.signal});if(r.ok){const d=await r.json() as {unread:number};if(!c.signal.aborted)setCount(Number(d.unread)||0)}else if(r.status===401)setCount(0)}catch{/* Keep the last known count until the next refresh. */}finally{running=false}}
 void refresh();const timer=setInterval(refresh,10000);window.addEventListener('gsl-messages-changed',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{c.abort();clearInterval(timer);window.removeEventListener('gsl-messages-changed',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}},[]);
 return <Link className="header-message-link" href="/messagerie" aria-label={l('Messages','Messagerie')+(count?' · '+count+' '+l('unread','non lus'):'')}><MessageSquare size={19}/><span>{l('Messages','Messages')}</span>{count>0&&<b>{count>99?'99+':count}</b>}</Link>;
}
