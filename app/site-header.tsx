'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowUpRight,Heart,LayoutGrid,LoaderCircle,Menu,UserRound,X} from 'lucide-react';
import Link from '@/components/site-link';
import {LanguageSelector,useLanguage} from './language';
import MessageLink from './message-link';

export default function SiteHeader({path,signedIn,loading,favorites,children}:{path:string;signedIn:boolean;loading:boolean;favorites:number;children:ReactNode}) {
 const {l}=useLanguage();
 const [open,setOpen]=useState(false);
 const toggle=useRef<HTMLButtonElement>(null);
 const header=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!open)return;
  function dismiss(event:KeyboardEvent){if(event.key==='Escape'){setOpen(false);toggle.current?.focus();}}
  function outside(event:PointerEvent){if(event.target instanceof Node&&!header.current?.contains(event.target))setOpen(false);}
  function resize(){if(window.innerWidth>760)setOpen(false);}
  document.addEventListener('keydown',dismiss);
  document.addEventListener('pointerdown',outside);
  window.addEventListener('resize',resize);
  return()=>{document.removeEventListener('keydown',dismiss);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize);};
 },[open]);
 const primary=[
  [l('Products','Produits'),'/catalogue'],
  [l('Manufacturers','Fabricants'),'/fabricants'],
  [l('Describe my requirement','Décrire mon besoin'),'/decrire-mon-besoin'],
 ];
 const discovery=[[l('Industries','Secteurs'),'/secteurs'],[l('Countries','Pays'),'/pays']];
 const company=[signedIn?l('My company','Mon entreprise'):l('Join as a supplier','Devenir fournisseur'),'/espace-fournisseur'];
 function active(href:string){
  if(href==='/catalogue')return path==='/catalogue'||path.startsWith('/produits/');
  if(href==='/decrire-mon-besoin')return path===href||path==='/demande-de-devis';
  return path===href||path.startsWith(href+'/');
 }
 function navLink([label,href]:string[],icon=false){return <Link key={href} href={href} className={[active(href)?'active':'',href==='/decrire-mon-besoin'?'header-request-nav':''].filter(Boolean).join(' ')||undefined} aria-current={active(href)?'page':undefined} onClick={()=>setOpen(false)}>{icon&&<LayoutGrid size={15} aria-hidden/>}{label}</Link>;}
 return <header className="site-header" ref={header}>
  <div className="header-main container">
   <Link href="/" aria-label="GSL systems">{children}</Link>
   <div className="header-tools">
    <LanguageSelector/>
    {signedIn&&<MessageLink/>}
    {signedIn&&<Link href="/selection" className="header-icon" aria-label={l('Saved products','Ma sélection')} title={l('Saved products','Ma sélection')} aria-current={active('/selection')?'page':undefined}><Heart size={19} aria-hidden/><span>{l('Saved products','Ma sélection')}</span>{favorites>0&&<b>{favorites}</b>}</Link>}
    <div className="header-account-actions" aria-busy={loading}>
     {loading?<span className="account-signin account-loading" role="status"><LoaderCircle size={18} aria-hidden/>{l('Loading…','Chargement…')}</span>:<Link href={signedIn?'/compte':'/connexion'} className="account-signin" aria-current={active(signedIn?'/compte':'/connexion')?'page':undefined}><UserRound size={18} aria-hidden/>{signedIn?l('My workspace','Mon espace'):l('My account','Mon compte')}</Link>}
    </div>
    <Link href="/decrire-mon-besoin" className="button-link header-quote">{l('Request a quote','Demander un devis')}<ArrowUpRight size={15} aria-hidden/></Link>
    <button type="button" ref={toggle} className="menu-toggle" aria-expanded={open} aria-controls="site-mobile-navigation" aria-label={l('Toggle navigation','Ouvrir ou fermer le menu')} onClick={()=>setOpen(value=>!value)}>{open?<X/>:<Menu/>}</button>
   </div>
  </div>
  <div className="header-nav"><nav className="container">
   {primary.map((item,index)=>navLink(item,index===0))}
   <span className="secondary-navigation">{discovery.map(item=>navLink(item))}</span>
   <Link href={company[1]} className={'supplier-nav'+(active(company[1])?' active':'')} aria-current={active(company[1])?'page':undefined}>{company[0]}<ArrowUpRight size={14} aria-hidden/></Link>
  </nav></div>
  <nav id="site-mobile-navigation" className="mobile-navigation" hidden={!open}>
   {primary.map(item=>navLink(item))}
   {discovery.map(item=>navLink(item))}
   {navLink(company)}
   {signedIn&&<div className="mobile-member-links">
    {navLink([l('Messages','Messagerie'),'/messagerie'])}
    {navLink([l('Saved products','Ma sélection'),'/selection'])}
    {navLink([l('My requests','Mes demandes'),'/operations'])}
   </div>}
  </nav>
 </header>;
}
