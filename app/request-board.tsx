'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {ArrowRight,Lock,Search} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import {countryName} from '@/lib/country-names';
import {roboticsFamilies} from '@/lib/robotics';
import {filterRequests,OTHER_FAMILY,type Ranked,type Reason} from '@/lib/request-board/ranking';
type Row=Ranked;
type Board={signedIn:boolean;unlocked:boolean;ranked:boolean;organizations:{id:string;name:string;country:string}[];counts:Record<string,number>;requests:Row[]};
type State='loading'|'ready'|'pending'|'error';

/** Buyers' custom quote requests, by robotics family. Visitors see a locked summary; manufacturer members see lines and can offer a quote. */
export default function RequestBoard(){
 const {l,language}=useLanguage();
 const [board,setBoard]=useState<Board|null>(null),[state,setState]=useState<State>('loading'),[attempt,setAttempt]=useState(0);
 const [family,setFamily]=useState(''),[destination,setDestination]=useState(''),[within,setWithin]=useState(''),[minQ,setMinQ]=useState(''),[maxQ,setMaxQ]=useState(''),[q,setQ]=useState('');
 const [open,setOpen]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState<Record<string,string>>({});
 useEffect(()=>{const c=new AbortController();setState('loading');fetch('/api/request-board',{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({})) as {error?:string};if(!r.ok){setState(d.error==='NOT_CONFIGURED'?'pending':'error');return}setBoard(d as Board);setState('ready')}).catch(e=>{if(e.name!=='AbortError')setState('error')});return()=>c.abort()},[attempt]);
 const familyLabel=(id:string)=>{const f=roboticsFamilies.find(x=>x.id===id);return f?l(f.en,f.fr):l('Other','Autre')};
 const date=(v:string)=>new Intl.DateTimeFormat(language,{day:'numeric',month:'short',year:'numeric'}).format(new Date(v));
 const units:Record<string,string>={pcs:l('pcs','pcs'),set:l('sets','lots'),kg:'kg',m:'m',m2:'m²'};
 const reason=(r:Reason)=>r.key==='family'&&r.family?l('Matches your products: ','Correspond à vos produits : ')+familyLabel(r.family).toLowerCase():l(r.en,r.fr).replace('{n}',String(r.n??''));
 const num=(v:string)=>v.trim()&&Number.isFinite(Number(v.replace(',','.')))?Number(v.replace(',','.')):null;
 const rows=useMemo(()=>board?filterRequests(board.requests,{family:family||undefined,destination:destination||undefined,deadlineWithin:within?Number(within):null,minQuantity:num(minQ),maxQuantity:num(maxQ),q},new Date()):[],[board,family,destination,within,minQ,maxQ,q]);
 const destinations=useMemo(()=>[...new Set(board?.requests.map(r=>r.destination).filter(Boolean)||[])].sort(),[board]);
 const families=[...roboticsFamilies.map(f=>f.id as string),OTHER_FAMILY];
 async function respond(e:FormEvent<HTMLFormElement>,reference:string){
  e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);
  try{const r=await fetch('/api/request-board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'respond',reference,organization:f.get('organization'),message:String(f.get('message')||''),leadTime:String(f.get('leadTime')||'')})});const d=await r.json().catch(()=>({})) as {error?:string};
   setNotice(n=>({...n,[reference]:r.ok?l('Your proposal was sent to GSL. GSL reviews it and presents it to the buyer.','Votre proposition est transmise à GSL, qui l’étudie et la présente à l’acheteur.'):d.error==='INVALID'?l('Write at least 20 characters.','Écrivez au moins 20 caractères.'):l('The proposal could not be sent. Try again in a moment.','La proposition n’a pas pu être envoyée. Réessayez dans un instant.')}));
   if(r.ok){setOpen('');setBoard(b=>b&&{...b,requests:b.requests.map(x=>x.reference===reference?{...x,responded_at:new Date().toISOString()}:x)})}}
  finally{setBusy(false)}
 }
 const access=!board?.unlocked&&(board?.signedIn
  ?<div className="board-access"><Lock size={20} aria-hidden/><div><h2>{l('Details are reserved for manufacturer accounts','Le détail est réservé aux comptes fabricants')}</h2><p>{l('You are signed in with a buyer account. To protect buyers, only members of a registered manufacturer see the lines and quantities. Your own requests are in your request tracking.','Vous êtes connecté avec un compte acheteur. Pour protéger les acheteurs, seuls les membres d’un fabricant inscrit voient les lignes et les quantités. Vos propres demandes sont dans votre suivi.')}</p><div className="board-access-actions"><Link className="board-primary" href="/suivi">{l('My requests','Mes demandes')}<ArrowRight size={17} aria-hidden/></Link><Link href="/devenir-fournisseur">{l('Register my company as a manufacturer','Inscrire mon entreprise comme fabricant')}</Link></div></div></div>
  :<div className="board-access"><Lock size={20} aria-hidden/><div><h2>{l('Details are reserved for registered manufacturers','Le détail est réservé aux fabricants inscrits')}</h2><p>{l('Sign in with a manufacturer account to see each request’s title, lines and quantities, then propose a quote through GSL. Buyer identity and contact details are never shown.','Connectez-vous avec un compte fabricant pour voir le titre, les lignes et les quantités de chaque demande, puis proposer un devis via GSL. L’identité et les coordonnées de l’acheteur ne sont jamais affichées.')}</p><div className="board-access-actions"><Link className="board-primary" href="/inscription?profil=fournisseur&next=%2Fdemandes">{l('Register as a manufacturer','M’inscrire comme fabricant')}<ArrowRight size={17} aria-hidden/></Link><Link href="/connexion?next=%2Fdemandes">{l('Sign in','Se connecter')}</Link></div></div></div>);
 return <main className="container request-board">
  <header className="board-intro"><h1>{l('Custom quote requests','Demandes de devis sur mesure')}</h1><p>{l('European buyers describe their robotics component needs. Each request is published as an anonymous summary, sorted by family.','Des acheteurs européens décrivent leurs besoins en composants robotiques. Chaque demande est publiée sous forme de résumé anonyme, classée par famille.')}</p></header>
  {state==='ready'&&access}
  {state==='loading'?<p className="board-status" role="status">{l('Loading requests…','Chargement des demandes…')}</p>
  :state==='pending'?<div className="board-status"><p>{l('The request board is waiting for its database update. Requests will appear here as soon as it is applied.','La page des demandes attend sa mise à jour de base de données. Les demandes apparaîtront ici dès qu’elle sera appliquée.')}</p></div>
  :state==='error'||!board?<div className="board-status"><p>{l('Requests could not be loaded.','Les demandes n’ont pas pu être chargées.')}</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>{l('Try again','Réessayer')}</button></div>
  :<div className="board-layout">
   <nav className="board-families-nav" aria-label={l('Families','Familles')}>
    <button type="button" aria-pressed={!family} onClick={()=>setFamily('')}><span>{l('All requests','Toutes les demandes')}</span><b>{board.requests.length}</b></button>
    {families.map(f=><button key={f} type="button" aria-pressed={family===f} onClick={()=>setFamily(f)}><span>{familyLabel(f)}</span><b>{board.counts[f]||0}</b></button>)}
   </nav>
   <section className="board-main">
    <div className="board-filters">
     <label className="board-search"><Search size={16} aria-hidden/><span className="sr-only">{l('Search','Rechercher')}</span><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder={board.unlocked?l('Search a reference or a component','Rechercher une référence ou un composant'):l('Search a reference','Rechercher une référence')}/></label>
     <label>{l('Delivery to','Livraison')}<select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">{l('All countries','Tous les pays')}</option>{destinations.map(c=><option key={c} value={c}>{countryName(c,language)}</option>)}</select></label>
     <label>{l('Deadline','Échéance')}<select value={within} onChange={e=>setWithin(e.target.value)}><option value="">{l('Any','Toutes')}</option><option value="30">{l('Within 30 days','Sous 30 jours')}</option><option value="90">{l('Within 90 days','Sous 90 jours')}</option><option value="180">{l('Within 6 months','Sous 6 mois')}</option></select></label>
     <fieldset className="board-quantity"><legend>{l('Total quantity','Quantité totale')}</legend><input inputMode="decimal" aria-label={l('Minimum','Minimum')} placeholder={l('Min','Min')} value={minQ} onChange={e=>setMinQ(e.target.value)}/><input inputMode="decimal" aria-label={l('Maximum','Maximum')} placeholder={l('Max','Max')} value={maxQ} onChange={e=>setMaxQ(e.target.value)}/></fieldset>
    </div>
    <p className="board-sort">{board.ranked?l('Sorted by relevance to your products, capabilities, minimum order and lead time.','Triées selon leur pertinence pour vos produits, vos capacités, votre minimum de commande et votre délai.'):l('Sorted by publication date and deadline.','Triées par date de publication et échéance.')} {rows.length} {l('requests','demandes')}</p>
    {!board.requests.length?<p className="board-status">{l('No request is published at the moment.','Aucune demande n’est publiée pour le moment.')}</p>
    :!rows.length?<p className="board-status">{l('No request matches these filters.','Aucune demande ne correspond à ces filtres.')}</p>
    :<ul className="board-list">{rows.map(r=><li key={r.reference} className={board.unlocked?'is-unlocked':'is-locked'}>
     <div className="board-head"><span className="board-ref">{r.reference}</span>{board.ranked&&r.score!=null&&<span className="board-score" title={l('Relevance score out of 100','Score de pertinence sur 100')}>{r.score}/100</span>}</div>
     <ul className="board-tags">{r.families.map(f=><li key={f}>{familyLabel(f)}</li>)}</ul>
     {board.unlocked&&r.title?<h3 dir="auto">{r.title}</h3>:<div className="board-blur" aria-hidden><span/><span/></div>}
     {r.reasons.length>0&&<ul className="board-reasons">{r.reasons.map(x=><li key={x.key}>{reason(x)}</li>)}</ul>}
     <dl>
      <div><dt>{l('Delivery to','Livraison')}</dt><dd>{r.destination?countryName(r.destination,language):l('Not specified','Non renseigné')}</dd></div>
      <div><dt>{l('Lines','Lignes')}</dt><dd>{r.lines}</dd></div>
      <div><dt>{l('Deadline','Échéance')}</dt><dd>{r.deadline?date(r.deadline):l('Not specified','Non précisée')}</dd></div>
      <div><dt>{l('Published','Publiée')}</dt><dd>{date(r.shared_at)}</dd></div>
     </dl>
     {board.unlocked&&r.items?<ul className="board-items">{r.items.map((item,i)=><li key={i}><span dir="auto">{item.description}</span><b>{item.quantity.toLocaleString(language)} {units[item.unit]||item.unit}</b></li>)}</ul>:<div className="board-blur board-blur-lines" aria-hidden><span/><span/><span/></div>}
     {notice[r.reference]&&<p className="board-notice" role="status">{notice[r.reference]}</p>}
     {board.unlocked&&(open===r.reference?<form className="board-respond" onSubmit={e=>void respond(e,r.reference)}>
      {board.organizations.length>1?<label>{l('Reply as','Répondre au nom de')}<select name="organization">{board.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>:<input type="hidden" name="organization" value={board.organizations[0]?.id||''}/>}
      <label>{l('Your proposal','Votre proposition')}<textarea name="message" required minLength={20} maxLength={4000} rows={4} placeholder={l('Indicative price, what you can supply, questions for the buyer…','Prix indicatif, ce que vous pouvez fournir, questions pour l’acheteur…')}/></label>
      <label>{l('Lead time','Délai')}<input name="leadTime" maxLength={200} placeholder={l('e.g. 6 weeks','ex. 6 semaines')}/></label>
      <p>{l('GSL receives your proposal and presents it to the buyer. Your company name is shared with GSL only.','GSL reçoit votre proposition et la présente à l’acheteur. Le nom de votre entreprise n’est communiqué qu’à GSL.')}</p>
      <div className="board-respond-actions"><button className="board-primary" disabled={busy}>{busy?l('Sending…','Envoi…'):l('Send to GSL','Envoyer à GSL')}</button><button type="button" onClick={()=>setOpen('')}>{l('Cancel','Annuler')}</button></div>
     </form>:<button type="button" className="board-reply" onClick={()=>setOpen(r.reference)}>{r.responded_at?l('Update my proposal','Modifier ma proposition'):l('Reply / propose a quote','Répondre / proposer un devis')}<ArrowRight size={16} aria-hidden/></button>)}
    </li>)}</ul>}
   </section>
  </div>}
 </main>;
}
