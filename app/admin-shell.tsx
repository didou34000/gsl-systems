'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Activity,ArrowUpRight,Building2,ChevronRight,Globe2,Inbox,LayoutDashboard,ListTodo,LogOut,Package,Settings2,ShieldCheck,UserCheck,BookOpen,LockKeyhole} from 'lucide-react';
import Link from '@/components/site-link';
import BrandLogo from '@/components/brand-logo';
import {useLanguage,type Language} from './language';
import {adminLanguages,adminTranslate,type AdminKey} from '@/lib/admin/translations';
import {accessTranslate} from '@/lib/admin/access-translations';
import {adminRoles,adminPermissions,type AdminPermission,type AdminRole} from '@/lib/admin/permissions';

export type AdminSection='sourcing'|'overview'|'companies'|'products'|'review'|'catalogue'|'inbox'|'tasks'|'activity'|'access'|'settings';
export type AdminShellViewer={email:string;role:AdminRole;permissions:readonly AdminPermission[];reviewer:boolean};

const icons:Record<AdminSection,typeof LayoutDashboard>={sourcing:Package,overview:LayoutDashboard,companies:Building2,products:Package,review:UserCheck,catalogue:BookOpen,inbox:Inbox,tasks:ListTodo,activity:Activity,access:ShieldCheck,settings:Settings2};
const pages:Partial<Record<AdminSection,string>>={sourcing:'/administration/sourcing',review:'/administration/revue',catalogue:'/administration/catalogue'};
const roleKeys={owner:'roleOwner',admin:'roleAdmin',operator:'roleOperator',analyst:'roleAnalyst'} as const;

/** UI guidance only: the API and PostgreSQL enforce every permission independently. */
export function adminSectionAllowed(viewer:AdminShellViewer|null,id:AdminSection){
 if(!viewer)return id==='overview';
 const can=(permission:AdminPermission)=>viewer.permissions.includes(permission);
 if(id==='overview')return can('overview.read');
 if(id==='companies'||id==='products')return can('catalog.read');
 if(id==='sourcing')return can('contacts.read');
 if(id==='inbox')return can('contacts.read');
 if(id==='activity')return can('activity.read');
 if(id==='review')return viewer.reviewer;
 if(id==='catalogue')return viewer.role==='owner';
 return true;
}

export function validAdminViewer(value:unknown):value is AdminShellViewer{
 const viewer=value as AdminShellViewer|null;
 return Boolean(viewer&&typeof viewer.email==='string'&&adminRoles.includes(viewer.role)&&Array.isArray(viewer.permissions)&&viewer.permissions.every(permission=>adminPermissions.includes(permission)));
}

export function AdminLanguageSelect(){
 const {language,setLanguage}=useLanguage();
 return <label className="adm-language"><Globe2 size={15} aria-hidden/><span className="admin-sr-only">{adminTranslate(language,'language')}</span><select value={language} onChange={event=>setLanguage(event.target.value as Language)}>{adminLanguages.map(item=><option value={item.code} key={item.code}>{item.name}</option>)}</select></label>;
}

/** Shared frame for every administration page: same sidebar language as the signed-in workspace. */
export default function AdminShell({current,viewer,counts={},onSelect,title,toolbar,children}:{current:AdminSection;viewer:AdminShellViewer|null;counts?:Partial<Record<AdminSection,number>>;onSelect?:(id:AdminSection)=>void;title?:string;toolbar?:ReactNode;children:ReactNode}){
 const {language}=useLanguage();
 const t=(key:AdminKey)=>adminTranslate(language,key);
 const [leaving,setLeaving]=useState(false);
 const label=(id:AdminSection)=>id==='sourcing'?'Sourcing, devis et livraison':id==='access'?accessTranslate(language,'access'):id==='review'?t('reviewWorkspace'):id==='catalogue'?t('catalogueAdmin'):t(id);
 const sections:{label:string;items:AdminSection[]}[]=[
  {label:t('navPlatform'),items:['overview','companies','products','review','catalogue']},
  {label:t('navFollowUp'),items:['sourcing','inbox','tasks','activity']},
  {label:t('admin'),items:['access','settings']},
 ];
 const groups=sections.map(group=>({...group,items:group.items.filter(id=>adminSectionAllowed(viewer,id))})).filter(group=>group.items.length);
 async function signOut(){setLeaving(true);try{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}finally{window.location.assign('/connexion');}}
 const initials=(viewer?.email||'?').split(/[@.\s_-]+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join('');
 const item=(id:AdminSection)=>{const Icon=icons[id];const count=counts[id];const active=current===id;const content=<><Icon size={17} aria-hidden/><span>{label(id)}</span>{!!count&&count>0&&<b>{count>99?'99+':new Intl.NumberFormat(language).format(count)}</b>}</>;
  if(onSelect&&!pages[id])return <button type="button" key={id} aria-current={active?'page':undefined} onClick={()=>onSelect(id)}>{content}</button>;
  return <Link key={id} href={pages[id]||'/administration#'+id} aria-current={active?'page':undefined}>{content}</Link>;};
 return <div className="adm-shell" dir={language==='ar'?'rtl':'ltr'}>
  <aside className="adm-sidebar" aria-label={t('admin')}><div className="adm-sidebar-inner">
   <div className="adm-brand"><Link href="/" aria-label="GSL systems"><BrandLogo eager/></Link><span>{t('admin')}</span></div>
   {viewer&&<div className="adm-identity"><span className="adm-avatar" aria-hidden>{initials}</span><div><strong><bdi>{viewer.email}</bdi></strong><span>{accessTranslate(language,roleKeys[viewer.role])}</span></div></div>}
   <nav aria-label={t('admin')}>{groups.map(group=><div className="adm-group" key={group.label}><p>{group.label}</p>{group.items.map(item)}</div>)}</nav>
   <div className="adm-sidebar-foot">
    <Link href="/compte/securite?next=%2Fadministration"><LockKeyhole size={17} aria-hidden/><span>{t('accountSecurity')}</span></Link>
    <Link href="/"><ArrowUpRight size={17} aria-hidden/><span>{t('platform')}</span></Link>
    {viewer&&<button type="button" disabled={leaving} onClick={()=>void signOut()}><LogOut size={17} aria-hidden/><span>{t('signOut')}</span></button>}
   </div>
  </div></aside>
  <div className="adm-main">
   <header className="adm-topbar"><div className="adm-crumbs"><Link className="adm-mobile-brand" href="/" aria-label="GSL systems"><BrandLogo/></Link><span>{t('admin')}</span><ChevronRight className="adm-flip" size={13} aria-hidden/><strong>{title||label(current)}</strong></div><div className="adm-topbar-tools">{toolbar}<AdminLanguageSelect/></div></header>
   {children}
  </div>
 </div>;
}

/** Wraps the review and catalogue pages so they share the administration navigation. */
export function AdminFrame({current,children}:{current:AdminSection;children:ReactNode}){
 const [viewer,setViewer]=useState<AdminShellViewer|null>(null),[openContacts,setOpenContacts]=useState(0);
 useEffect(()=>{const controller=new AbortController();fetch('/api/admin',{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)return;const payload=await response.json() as {viewer?:unknown;stats?:{openContacts?:number}};if(validAdminViewer(payload.viewer)){setViewer(payload.viewer);setOpenContacts(payload.stats?.openContacts||0);}}).catch(()=>{});return()=>controller.abort();},[]);
 return <AdminShell current={current} viewer={viewer} counts={{inbox:viewer?.permissions.includes('contacts.read')?openContacts:0}}><div className="adm-frame-content">{children}</div></AdminShell>;
}
