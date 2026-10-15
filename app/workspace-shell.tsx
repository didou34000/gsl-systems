'use client';
import {useState,type ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {LayoutDashboard,MessageSquare,FileText,Heart,Factory,Building2,Package,Settings,ShieldCheck,LogOut,Plus} from 'lucide-react';
import type {WorkspaceCompany} from './marketplace';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import {useUnreadMessages} from './message-link';

/** Routes that belong to the signed-in workspace and share its navigation. */
export const workspaceRoutes=['/compte','/messagerie','/operations','/espace-fournisseur','/mes-produits','/selection','/compte/securite'];

type Item={href:string;label:string;Icon:typeof LayoutDashboard;count?:number;current:boolean};

export default function WorkspaceShell({path,user,company=null,companyLabel='',favorites,children}:{path:string;user:{name:string;email:string}|null;company?:WorkspaceCompany|null;companyLabel?:string;favorites:number;children:ReactNode}){
 // A manufacturer-only company has no purchasing side, so its menu leaves out requests and quotes.
 const buyerTools=!company||company.buyer;
 const {l}=useLanguage();const query=useSearchParams();const unread=useUnreadMessages();const [leaving,setLeaving]=useState(false);
 const settings=path==='/compte'&&query.get('vue')==='parametres';
 const groups:{label:string;items:Item[]}[]=[
  {label:buyerTools?l('Purchasing','Achats'):l('Activity','Activité'),items:[
   {href:'/compte',label:l('Overview','Vue d’ensemble'),Icon:LayoutDashboard,current:path==='/compte'&&!settings},
   {href:'/messagerie',label:l('Messages','Messagerie'),Icon:MessageSquare,count:unread,current:path==='/messagerie'},
   ...(buyerTools?[{href:'/operations',label:l('Requests and quotes','Demandes et devis'),Icon:FileText,current:path==='/operations'}]:[]),
   {href:'/selection',label:l('Saved products','Ma sélection'),Icon:Heart,count:favorites,current:path==='/selection'},
  ]},
  {label:l('My company','Mon entreprise'),items:[
   {href:'/espace-fournisseur',label:l('Company profile','Profil entreprise'),Icon:Factory,current:path==='/espace-fournisseur'},
   {href:'/mes-produits',label:l('My products','Mes produits'),Icon:Package,current:path==='/mes-produits'},
  ]},
  {label:l('Account','Compte'),items:[
   {href:'/compte?vue=parametres',label:l('Account settings','Paramètres du compte'),Icon:Settings,current:settings},
   {href:'/compte/securite',label:l('Security','Sécurité'),Icon:ShieldCheck,current:path==='/compte/securite'},
  ]},
 ];
 async function signOut(){setLeaving(true);try{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})})}finally{window.location.assign('/connexion')}}
 const initials=(user?.name||user?.email||'?').split(/[\s@.]+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join('');
 return <div className="ws-shell">
  <aside className="ws-sidebar" aria-label={l('Workspace navigation','Navigation de l’espace')}><div className="ws-sidebar-inner">
   <div className="ws-identity">
    <span className="ws-avatar" aria-hidden>{company?company.supplier?<Factory size={18}/>:<Building2 size={18}/>:initials}</span>
    <div><strong dir="auto">{companyLabel||company?.name||user?.name||l('My account','Mon compte')}</strong>{user?.email&&<span>{user.email}</span>}</div>
   </div>
   {buyerTools&&<Link className="ws-new" href="/decrire-mon-besoin"><Plus size={16} aria-hidden/>{l('New request','Nouvelle demande')}</Link>}
   <nav>
    {groups.map(group=><div className="ws-group" key={group.label}>
     <p>{group.label}</p>
     {group.items.map(({href,label,Icon,count,current})=><Link key={href} href={href} aria-current={current?'page':undefined}><Icon size={17} aria-hidden/><span>{label}</span>{!!count&&count>0&&<b>{count>99?'99+':count}</b>}</Link>)}
    </div>)}
   </nav>
   <button type="button" className="ws-signout" disabled={leaving} onClick={()=>void signOut()}><LogOut size={17} aria-hidden/>{l('Sign out','Se déconnecter')}</button>
  </div></aside>
  <div className="ws-main">{children}</div>
 </div>;
}

/** Renders the workspace navigation around signed-in pages and leaves every other page untouched. */
export function WorkspaceFrame({active,children,...props}:{active:boolean;path:string;user:{name:string;email:string}|null;company?:WorkspaceCompany|null;companyLabel?:string;favorites:number;children:ReactNode}){
 return active?<WorkspaceShell {...props}>{children}</WorkspaceShell>:<>{children}</>;
}
