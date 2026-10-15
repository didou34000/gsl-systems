'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowUpRight,Building2,Factory,Heart,LayoutGrid,LoaderCircle,Menu,UserRound,X} from 'lucide-react';
import type {WorkspaceCompany} from './marketplace';
import Link from '@/components/site-link';
import {LanguageSelector,useLanguage} from './language';
import MessageLink from './message-link';

export default function SiteHeader({path,signedIn,loading,favorites,company:workspaceCompany=null,companyLabel='',accountName='',children}:{path:string;signedIn:boolean;loading:boolean;favorites:number;company?:WorkspaceCompany|null;companyLabel?:string;accountName?:string;children:ReactNode}) {
 const {l}=useLanguage();
 // A manufacturer-only account has no purchasing side: quote requests are a buyer feature.
 const buyerTools=!signedIn||!workspaceCompany||workspaceCompany.buyer;
 const AccountIcon=!signedIn?UserRound:workspaceCompany?.supplier?Factory:workspaceCompany?Building2:UserRound;
 const accountLabel=signedIn?companyLabel||workspaceCompany?.name||accountName||l('My account','Mon compte'):l('My account','Mon compte');
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
  [l('Components','Composants'),'/catalogue'],[l('Manufacturers','Fabricants'),'/fabricants'],
  [l('Buyer requests','Demandes d’achat'),'/demandes'],
  [l('Blog','Blog'),'/blog'],
  ...(buyerTools?[[l('Describe my requirement','Décrire mon besoin'),'/decrire-mon-besoin']]:[]),
 ];
 // Countries sits on the right of the bar, next to the supplier link.
 const discovery:string[][]=[[l('Countries','Pays'),'/pays']];

 const company=[signedIn?l('My company','Mon entreprise'):l('Join as a supplier','Devenir fournisseur'),'/espace-fournisseur'];
 function active(href:string){
  if(href==='/catalogue')return path==='/catalogue'||path.startsWith('/produits/');
  if(href==='/decrire-mon-besoin')return path===href||path==='/demande-de-devis';
  return path===href||path.startsWith(href+'/');
 }
 function navLink([label,href]:string[],icon=false){return <Link key={href} href={href} className={[active(href)?'active':'',href==='/decrire-mon-besoin'?'header-request-nav':''].filter(Boolean).join(' ')||undefined} aria-current={active(href)?'page':undefined} onClick={()=>setOpen(false)}>{icon&&<LayoutGrid size={15} aria-hidden/>}{label}</Link>;}
 return <header className="site-header" ref={header}>
  <div className="header-main container">
   <div className="header-brand"><Link href="/" aria-label="GSL systems">{children}</Link><span className="header-tagline">{l('Components for robotics','Composants pour la robotique')}</span></div>
   <div className="header-tools">
    <LanguageSelector/>
    {signedIn&&<MessageLink/>}
    {signedIn&&<Link href="/selection" className="header-icon" aria-label={l('Saved products','Ma sélection')} title={l('Saved products','Ma sélection')} aria-current={active('/selection')?'page':undefined}><Heart size={19} aria-hidden/><span>{l('Saved products','Ma sélection')}</span>{favorites>0&&<b>{favorites}</b>}</Link>}
    <div className="header-account-actions" aria-busy={loading}>
     {loading?<span className="account-signin account-loading" role="status"><LoaderCircle size={18} aria-hidden/>{l('Loading…','Chargement…')}</span>:<Link href={signedIn?'/compte':'/connexion'} className={'account-signin'+(signedIn?' account-company':'')} title={signedIn?accountLabel:undefined} aria-current={active(signedIn?'/compte':'/connexion')?'page':undefined}><AccountIcon size={18} aria-hidden/><span dir="auto">{accountLabel}</span></Link>}
    </div>
    {buyerTools&&<Link href="/decrire-mon-besoin" className="button-link header-quote">{l('Request a quote','Demander un devis')}<ArrowUpRight size={15} aria-hidden/></Link>}
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
    {buyerTools&&navLink([l('My requests','Mes demandes'),'/operations'])}
   </div>}
  </nav>
 </header>;
}
