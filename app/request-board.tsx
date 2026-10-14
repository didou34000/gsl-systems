'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,Lock,LockOpen} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import {countryName} from '@/lib/country-names';
import {useCategoryLabel} from './catalogue-cards';
type BoardRequest={reference:string;shared_at:string;destination:string;deadline:string|null;lines:number;families:string[];title?:string;items?:{description:string;quantity:number;unit:string}[]};
type Board={unlocked:boolean;requests:BoardRequest[]};

/** Buyer requests shared with consent. Visitors see a locked summary; manufacturer members see titles and lines. */
export default function RequestBoard(){
 const {l,language}=useLanguage();const categoryLabel=useCategoryLabel();
 const [board,setBoard]=useState<Board|null>(null),[state,setState]=useState<'loading'|'ready'|'inactive'>('loading');
 useEffect(()=>{const controller=new AbortController();fetch('/api/request-board',{signal:controller.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<Board>}).then(d=>{setBoard(d);setState('ready')}).catch(e=>{if(e.name!=='AbortError')setState('inactive')});return()=>controller.abort()},[]);
 const date=(value:string)=>new Intl.DateTimeFormat(language,{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
 const unlocked=!!board?.unlocked;
 const units:Record<string,string>={pcs:l('pcs','pcs'),set:l('sets','lots'),kg:'kg',m:'m',m2:'m²'};
 const access=<div className="board-access"><Lock size={20} aria-hidden/><div><h2>{l('Details are reserved for registered manufacturers','Le détail est réservé aux fabricants inscrits')}</h2><p>{l('Create your manufacturer account to see each request’s title and lines, then reply through GSL. Buyer identity and contact details are never shown.','Créez votre compte fabricant pour voir le titre et les lignes de chaque demande, puis répondre via GSL. L’identité et les coordonnées de l’acheteur ne sont jamais affichées.')}</p><div className="board-access-actions"><Link className="board-primary" href="/inscription?profil=fournisseur&next=%2Fdemandes">{l('Register as a manufacturer','M’inscrire comme fabricant')}<ArrowRight size={17} aria-hidden/></Link><Link href="/connexion?next=%2Fdemandes">{l('Sign in','Se connecter')}</Link></div></div></div>;
 return <main className="container request-board">
  <header className="board-intro"><h1>{l('Buyer requests','Demandes d’achat')}</h1><p>{l('European buyers who agree to it publish a summary of their request here. Only the reference, destination, deadline and number of lines are public.','Les acheteurs européens qui l’acceptent publient ici un résumé de leur demande. Seuls la référence, la destination, l’échéance et le nombre de lignes sont publics.')}</p></header>
  {!unlocked&&state!=='loading'&&access}
  {state==='loading'?<p className="board-status" role="status">{l('Loading requests…','Chargement des demandes…')}</p>
  :state==='inactive'?<p className="board-status">{l('The request board is not active yet. Published requests will appear here.','La page des demandes n’est pas encore active. Les demandes publiées apparaîtront ici.')}</p>
  :!board?.requests.length?<p className="board-status">{l('No request is published at the moment.','Aucune demande n’est publiée pour le moment.')}</p>
  :<ul className="board-list">{board.requests.map(r=><li key={r.reference} className={unlocked?'is-unlocked':'is-locked'}>
   <div className="board-head"><span className="board-ref">{r.reference}</span>{unlocked?<LockOpen size={16} aria-label={l('Unlocked','Déverrouillé')}/>:<Lock size={16} aria-label={l('Locked','Verrouillé')}/>}</div>
   {unlocked&&r.title?<h3 dir="auto">{r.title}</h3>:<div className="board-blur" aria-hidden><span/><span/></div>}
   <dl>
    <div><dt>{l('Delivery to','Livraison')}</dt><dd>{countryName(r.destination,language)}</dd></div>
    <div><dt>{l('Lines','Lignes')}</dt><dd>{r.lines}</dd></div>
    <div><dt>{l('Deadline','Échéance')}</dt><dd>{r.deadline?date(r.deadline):l('Not specified','Non précisée')}</dd></div>
    <div><dt>{l('Published','Publiée')}</dt><dd>{date(r.shared_at)}</dd></div>
   </dl>
   {r.families.length>0&&<ul className="board-families">{r.families.map(f=><li key={f}>{categoryLabel(f)}</li>)}</ul>}
   {unlocked&&r.items?<ul className="board-items">{r.items.map((item,i)=><li key={i}><span dir="auto">{item.description}</span><b>{item.quantity} {units[item.unit]||item.unit}</b></li>)}</ul>:<div className="board-blur board-blur-lines" aria-hidden><span/><span/><span/></div>}
   {unlocked&&<Link className="board-reply" href="/contact">{l('Reply through GSL','Répondre via GSL')}<ArrowRight size={16} aria-hidden/></Link>}
  </li>)}</ul>}
 </main>;
}
