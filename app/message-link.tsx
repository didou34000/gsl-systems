'use client';
import {useEffect,useState} from 'react';
import {MessageSquare} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';
// One shared poller for every unread badge on the page (header and workspace navigation).
let unread=0;const subscribers=new Set<(count:number)=>void>();let stop:(()=>void)|null=null;
function startPolling(){
 const c=new AbortController();let running=false;
 async function refresh(){if(running||document.visibilityState!=='visible')return;running=true;try{const r=await fetch('/api/messaging?unread=1',{cache:'no-store',signal:c.signal});if(r.ok){const d=await r.json() as {unread:number};if(!c.signal.aborted)publish(Number(d.unread)||0)}else if(r.status===401)publish(0)}catch{/* Keep the last known count until the next refresh. */}finally{running=false}}
 void refresh();const timer=setInterval(refresh,10000);window.addEventListener('gsl-messages-changed',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
 return()=>{c.abort();clearInterval(timer);window.removeEventListener('gsl-messages-changed',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
}
function publish(count:number){unread=count;subscribers.forEach(notify=>notify(count))}
export function useUnreadMessages(){
 const [count,setCount]=useState(unread);
 useEffect(()=>{subscribers.add(setCount);if(!stop)stop=startPolling();return()=>{subscribers.delete(setCount);if(!subscribers.size&&stop){stop();stop=null}}},[]);
 return count;
}
export default function MessageLink(){
 const {l}=useLanguage();const count=useUnreadMessages();
 return <Link className="header-message-link" href="/messagerie" aria-label={l('Messages','Messagerie')+(count?' · '+count+' '+l('unread','non lus'):'')}><MessageSquare size={19}/><span>{l('Messages','Messages')}</span>{count>0&&<b>{count>99?'99+':count}</b>}</Link>;
}
