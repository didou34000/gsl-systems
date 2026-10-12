'use client';
import {useEffect,useRef,useState,useSyncExternalStore,type FormEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowRight,Building2,Check,FileText,LayoutDashboard,Search} from 'lucide-react';
import Link from '@/components/site-link';
import CountryPicker from '@/components/country-picker';
import JourneySteps from './journey-steps';
import {useLanguage} from './language';
import {safeNext} from '@/lib/auth-policy';
import {buyerCompanyFields,buyerFieldIssue,emptyBuyerCompany,type BuyerCompany,type BuyerField} from '@/lib/onboarding/buyer-company';
import {buyerDraftKey,purposeKey,writeStored} from '@/lib/onboarding/journey';

type Organization={id:string;legal_name:string;country_code?:string;buyer?:boolean;supplier?:boolean};

/** The purchasing-company questions. Used by the welcome page and by the empty state of requests. */
export function BuyerCompanyForm({onCreated,compact=false}:{onCreated:(organization:Organization)=>void;compact?:boolean}){
 const {l,language}=useLanguage();
 // The draft lives in this browser until the company is created.
 const stored=useSyncExternalStore(()=>()=>{},()=>{try{return localStorage.getItem(buyerDraftKey)||''}catch{return ''}},()=>'');
 const restored=(()=>{try{const d=JSON.parse(stored||'{}') as Partial<BuyerCompany>;return {...emptyBuyerCompany(),...Object.fromEntries(buyerCompanyFields.map(f=>[f.key,typeof d[f.key]==='string'?d[f.key]:'']))} as BuyerCompany}catch{return emptyBuyerCompany()}})();
 const [typed,setTyped]=useState<BuyerCompany|null>(null);const company=typed??restored;
 const [touched,setTouched]=useState<Record<string,boolean>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const command=useRef<string|null>(null);const formRef=useRef<HTMLFormElement>(null);
 const errors:Record<string,string>={RATE_LIMITED:l('Too many attempts. Wait a few minutes before trying again.','Trop de tentatives. Patientez quelques minutes avant de réessayer.'),LOGIN_REQUIRED:l('Sign in again to continue.','Reconnectez-vous pour continuer.'),UNAVAILABLE:l('The service is temporarily unavailable. Please try again.','Le service est momentanément indisponible. Réessayez.')};
 function update(key:BuyerField['key'],value:string){const next={...company,[key]:value};setTyped(next);setError('');command.current=null;writeStored(buyerDraftKey,JSON.stringify(next),'local')}
 const shown=(field:BuyerField)=>{if(!touched[field.key])return '';const issue=buyerFieldIssue(field,company[field.key]);return issue?l(...issue):''};
 async function submit(e:FormEvent){
  e.preventDefault();setTouched(Object.fromEntries(buyerCompanyFields.map(f=>[f.key,true])));
  const first=buyerCompanyFields.find(f=>buyerFieldIssue(f,company[f.key]));
  if(first){formRef.current?.querySelector<HTMLElement>(`[data-field="${first.key}"] :is(input,select)`)?.focus();return}
  setBusy(true);setError('');command.current??=crypto.randomUUID();
  try{
   const r=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'buyer_company',command:command.current,args:{name:company.name.trim(),country:company.country}})});
   const d=await r.json() as {error?:string;result?:{organizationId?:string}};
   if(!r.ok||!d.result?.organizationId){setError(r.status===401?'LOGIN_REQUIRED':d.error==='RATE_LIMITED'?'RATE_LIMITED':'UNAVAILABLE');return}
   writeStored(buyerDraftKey,'','local');
   onCreated({id:d.result.organizationId,legal_name:company.name.trim(),country_code:company.country,buyer:true});
  }catch{setError('UNAVAILABLE')}finally{setBusy(false)}
 }
 return <form ref={formRef} className={'ob-form'+(compact?' ob-form-compact':'')} noValidate onSubmit={submit}>
  {error&&<div className="ob-alert" role="alert">{errors[error]||errors.UNAVAILABLE}</div>}
  {buyerCompanyFields.map(field=>{const message=shown(field);const id='buyer-'+field.key;return <div key={field.key} className={'ob-field'+(message?' invalid':'')} data-field={field.key}>
   {field.kind==='country'
    ?<CountryPicker label={l(...field.label)} value={company.country} onChange={value=>{update('country',value);setTouched(t=>({...t,country:true}))}} language={language} disabled={busy}/>
    :<label className="sw-field"><span>{l(...field.label)}</span><input name={field.key} autoComplete={field.autoComplete} required={field.required} maxLength={field.max} value={company[field.key]} disabled={busy} onChange={e=>update(field.key,e.target.value)} onBlur={()=>setTouched(t=>({...t,[field.key]:true}))} aria-invalid={message?true:undefined} aria-describedby={id+'-hint'}/></label>}
   {message?<span className="ob-field-error" id={id+'-hint'}>{message}</span>:<small className="ob-hint" id={id+'-hint'}>{l(...field.hint)}</small>}
  </div>})}
  <div className="ob-actions">
   <button className="ui-btn ui-btn-primary" disabled={busy}>{busy?l('Please wait…','Veuillez patienter…'):l('Save my company','Enregistrer mon entreprise')}{!busy&&<ArrowRight size={17} aria-hidden/>}</button>
   {!compact&&<Link className="ui-btn ui-btn-ghost" href="/compte">{l('Later','Plus tard')}</Link>}
  </div>
 </form>;
}

export default function BuyerOnboarding(){
 const {l,language}=useLanguage();const search=useSearchParams();
 const back=search.get('next')?safeNext(search.get('next')):'';
 const [state,setState]=useState<'loading'|'guest'|'form'|'done'|'error'>('loading');
 const [organization,setOrganization]=useState<Organization|null>(null);
 const [supplierOrg,setSupplierOrg]=useState<Organization|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false);
 const enableCommand=useRef<string|null>(null);
 useEffect(()=>{let active=true;
  fetch('/api/platform',{cache:'no-store'}).then(async r=>{
   if(!active)return;if(r.status===401){setState('guest');return}if(!r.ok)throw Error();
   const d=await r.json() as {organizations?:Organization[]};const orgs=d.organizations||[];
   const buyer=orgs.find(o=>o.buyer);
   if(buyer){setOrganization(buyer);setState('done');return}
   setSupplierOrg(orgs[0]||null);setState('form');
  }).catch(()=>{if(active)setState('error')});
  return()=>{active=false}},[]);
 function created(org:Organization){writeStored(purposeKey,'');setOrganization(org);setState('done');window.scrollTo({top:0})}
 async function enableBuying(){
  if(!supplierOrg)return;setBusy(true);setError(false);enableCommand.current??=crypto.randomUUID();
  try{const r=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'enable_buyer',command:enableCommand.current,args:{organization:supplierOrg.id}})});if(!r.ok)throw Error();created({...supplierOrg,buyer:true})}
  catch{setError(true)}finally{setBusy(false)}
 }
 const country=organization?.country_code?new Intl.DisplayNames([language],{type:'region'}).of(organization.country_code):'';
 return <main className="container ob-page">
  {state==='loading'&&<p role="status" className="ob-card">{l('Loading your account…','Chargement de votre compte…')}</p>}
  {state==='error'&&<div className="ob-card"><div className="ob-alert" role="alert">{l('The service is temporarily unavailable. Please try again.','Le service est momentanément indisponible. Réessayez.')}</div><Link className="ui-btn ui-btn-secondary" href="/compte">{l('Go to my account','Aller à mon espace')}</Link></div>}
  {state==='guest'&&<div className="ob-card"><h1>{l('Sign in to continue','Connectez-vous pour continuer')}</h1><p className="ob-lead">{l('Your company is attached to your account. Sign in, then come back to this step.','Votre entreprise est rattachée à votre compte. Connectez-vous, puis revenez à cette étape.')}</p><div className="ob-actions"><Link className="ui-btn ui-btn-primary" href={'/connexion?next='+encodeURIComponent('/bienvenue')}>{l('Sign in','Se connecter')}<ArrowRight size={17} aria-hidden/></Link><Link className="ui-btn ui-btn-secondary" href="/inscription?profil=entreprise">{l('Create an account','Créer un compte')}</Link></div></div>}
  {state==='form'&&<div className="ob-card">
   <JourneySteps purpose="buyer" current={3}/>
   <h1>{l('Your company','Votre entreprise')}</h1>
   <p className="ob-lead">{l('Manufacturers see your company name and country with your requests. You can change them later.','Les fabricants voient le nom et le pays de votre entreprise avec vos demandes. Vous pourrez les modifier plus tard.')}</p>
   {supplierOrg?<div className="ob-existing">
    <p><Building2 size={18} aria-hidden/><span>{l('Your account already belongs to','Votre compte appartient déjà à')} <strong>{supplierOrg.legal_name}</strong>. {l('Allow this company to send quote requests as well.','Autorisez cette entreprise à envoyer aussi des demandes de devis.')}</span></p>
    {error&&<div className="ob-alert" role="alert">{l('The service is temporarily unavailable. Please try again.','Le service est momentanément indisponible. Réessayez.')}</div>}
    <div className="ob-actions"><button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={()=>void enableBuying()}>{busy?l('Please wait…','Veuillez patienter…'):l('Enable purchasing','Activer les achats')}</button><Link className="ui-btn ui-btn-ghost" href="/compte">{l('Later','Plus tard')}</Link></div>
   </div>:<BuyerCompanyForm onCreated={created}/>}
  </div>}
  {state==='done'&&organization&&<div className="ob-card ob-done">
   <span className="ob-done-mark" aria-hidden><Check size={26}/></span>
   <h1 tabIndex={-1}>{l('Your account is ready','Votre compte est prêt')}</h1>
   <p className="ob-lead"><strong>{organization.legal_name}</strong>{country?' · '+country:''}</p>
   <p>{l('You can now contact manufacturers and send quote requests.','Vous pouvez maintenant contacter des fabricants et envoyer des demandes de devis.')}</p>
   {back&&<Link className="ui-btn ui-btn-primary ob-resume" href={back}>{l('Resume where you left off','Reprendre là où vous en étiez')}<ArrowRight size={17} aria-hidden/></Link>}
   <h2>{l('What next?','Et maintenant ?')}</h2>
   <ul className="ob-next">
    <li><Link href="/catalogue"><Search size={20} aria-hidden/><span><strong>{l('Browse products','Consulter les produits')}</strong><small>{l('Search by process, material or country, and save what interests you.','Cherchez par procédé, matière ou pays, et enregistrez ce qui vous intéresse.')}</small></span><ArrowRight size={16} aria-hidden/></Link></li>
    <li><Link href="/decrire-mon-besoin"><FileText size={20} aria-hidden/><span><strong>{l('Describe my requirement','Décrire mon besoin')}</strong><small>{l('Describe the part, the quantity and the destination. Manufacturers reply here.','Décrivez la pièce, la quantité et la destination. Les fabricants répondent ici.')}</small></span><ArrowRight size={16} aria-hidden/></Link></li>
    <li><Link href="/compte"><LayoutDashboard size={20} aria-hidden/><span><strong>{l('Go to my account','Aller à mon espace')}</strong><small>{l('Follow your requests, messages and saved products.','Suivez vos demandes, messages et produits enregistrés.')}</small></span><ArrowRight size={16} aria-hidden/></Link></li>
   </ul>
   <p className="ob-note">{l('You also manufacture?','Vous fabriquez aussi ?')} <Link href="/espace-fournisseur?bienvenue=1">{l('Present your company to buyers','Présentez votre entreprise aux acheteurs')}</Link></p>
  </div>}
 </main>;
}
