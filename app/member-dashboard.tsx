'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {MessageSquare,FileText,Factory,ArrowRight,Package,Plus,ShieldCheck,Check,Search,RotateCw} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import AuthForm from './auth-form';
type Data={administration?:boolean;user:{name:string;email:string};favorites:number;requests:{id:string;title:string;state:string;organization_id:string;updated_at?:string}[];conversations:{id:string;product_name:string;buyer_organization_id:string;supplier_organization_id:string;updated_at?:string}[];organizations:{id:string;legal_name:string;buyer?:boolean}[];application:{status:string;name:string;products:number;updated_at?:string}|null};
type Tone='neutral'|'info'|'success'|'warning'|'danger';
const tones:Record<string,Tone>={draft:'neutral',sent:'info',closed:'success',cancelled:'neutral',outside_scope:'neutral',published_unverified:'info',submitted:'warning',in_review:'warning',changes_requested:'warning',reviewed:'success',rejected:'danger'};
export default function MemberDashboard(){
 const {l,language}=useLanguage();const query=useSearchParams();const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[now,setNow]=useState(0);
 useEffect(()=>{const c=new AbortController();fetch('/api/member',{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json() as Data&{error?:string};if(!r.ok)throw Error(d.error||'UNAVAILABLE');setNow(Date.now());setData(d);setError('')}).catch(e=>{if(e.name!=='AbortError')setError(e.message)});return()=>c.abort()},[attempt]);
 const status=(s:string)=>({outside_scope:l('Outside our current scope','Hors périmètre actuel'),published_unverified:l('Online · unverified','En ligne · non vérifiée'),draft:l('Draft','Brouillon'),submitted:l('Submitted for review','Dossier soumis'),in_review:l('Under review','En cours d’examen'),changes_requested:l('Information requested','Compléments demandés'),reviewed:l('Published','Publié'),rejected:l('Review feedback available','Retour d’examen disponible'),sent:l('Sent to manufacturers','Transmise aux fabricants'),closed:l('Quote selected','Offre retenue'),cancelled:l('Cancelled','Annulée')}[s]||s);
 const badge=(s:string)=><span className={'ws-badge ws-badge-'+(tones[s]||'neutral')}>{status(s)}</span>;
 const when=(date?:string)=>{if(!date)return '';const minutes=Math.round((Date.parse(date)-now)/60000);const format=new Intl.RelativeTimeFormat(language,{numeric:'auto'});if(Math.abs(minutes)<60)return format.format(minutes,'minute');if(Math.abs(minutes)<1440)return format.format(Math.round(minutes/60),'hour');if(Math.abs(minutes)<43200)return format.format(Math.round(minutes/1440),'day');return new Date(date).toLocaleDateString(language,{dateStyle:'medium'})};
 if(query.get('vue')==='parametres')return <AuthForm mode="account"/>;
 if(error==='LOGIN_REQUIRED')return <main className="container member-page"><section className="ws-gate"><h1>{l('Your professional workspace','Votre espace professionnel')}</h1><p>{l('Sign in to find your messages, saved products and requests.','Connectez-vous pour retrouver vos messages, votre sélection et vos demandes.')}</p><Link className="button-link" href="/connexion?next=%2Fcompte">{l('Sign in or create an account','Se connecter ou créer un compte')}</Link></section></main>;
 if(error)return <main className="ws-page"><div className="ws-state" role="alert"><p>{l('Your workspace could not be loaded.','Votre espace n’a pas pu être chargé.')}</p><button className="ui-btn ui-btn-secondary" onClick={()=>setAttempt(a=>a+1)}><RotateCw size={16} aria-hidden/>{l('Retry','Réessayer')}</button></div></main>;
 if(!data)return <main className="ws-page" aria-busy="true"><p className="ws-sr" role="status">{l('Loading your workspace…','Chargement de votre espace…')}</p><div className="ws-skeleton ws-skeleton-title"/><div className="ws-skeleton ws-skeleton-block"/><div className="ws-columns"><div className="ws-skeleton ws-skeleton-card"/><div className="ws-skeleton ws-skeleton-card"/></div></main>;
 const firstName=data.user.name.trim().split(/\s+/)[0]||'';
 const sentRequest=data.requests.some(r=>r.state!=='draft');
 const companyReady=!!data.application&&data.application.status!=='draft';
 const steps=[
  {done:true,title:l('Create your account','Créer votre compte'),text:l('Your email address is confirmed.','Votre adresse email est confirmée.'),href:'',action:''},
  {done:data.organizations.some(o=>o.buyer),title:l('Add your company','Renseigner votre entreprise'),text:l('Manufacturers see your company name and country with your requests.','Les fabricants voient le nom et le pays de votre entreprise avec vos demandes.'),href:'/bienvenue',action:l('Add my company','Ajouter mon entreprise')},
  {done:data.favorites>0,title:l('Save products you are interested in','Enregistrer des produits qui vous intéressent'),text:l('Use the heart on a product to keep it in your selection.','Utilisez le cœur d’une fiche produit pour la garder dans votre sélection.'),href:'/catalogue',action:l('Browse products','Consulter les produits')},
  {done:sentRequest,title:l('Send your first request','Envoyer votre première demande'),text:l('Describe the part, the quantity and the destination. Manufacturers reply here.','Décrivez la pièce, la quantité et la destination. Les fabricants répondent ici.'),href:'/decrire-mon-besoin',action:l('Describe my requirement','Décrire mon besoin')},
  {done:companyReady,title:l('Present your company (manufacturers)','Présenter votre entreprise (fabricants)'),text:l('Only needed if you want buyers to find you.','Seulement si vous souhaitez être trouvé par des acheteurs.'),href:'/espace-fournisseur',action:l('Open my company profile','Ouvrir mon profil entreprise')},
 ];
 const done=steps.filter(s=>s.done).length;const next=steps.slice(0,-1).find(s=>!s.done);
 const requestOrganization=(r:Data['requests'][number])=>data.organizations.find(o=>o.id===r.organization_id)?.id||data.organizations[0]?.id||'';
 return <main className="ws-page">
  <header className="ws-head">
   <div><h1>{firstName?l('Hello','Bonjour')+', '+firstName:l('Hello','Bonjour')}</h1><p>{l('Here is where your purchasing and your company stand.','Voici où en sont vos achats et votre entreprise.')}</p></div>
   <div className="ws-actions"><Link className="ui-btn ui-btn-secondary" href="/catalogue"><Search size={16} aria-hidden/>{l('Browse products','Consulter les produits')}</Link><Link className="ui-btn ui-btn-primary" href="/decrire-mon-besoin"><Plus size={16} aria-hidden/>{l('New request','Nouvelle demande')}</Link></div>
  </header>
  {data.administration&&<Link className="ws-admin" href="/administration"><ShieldCheck size={18} aria-hidden/><span><strong>{l('Administration','Administration')}</strong> · {l('Manage companies, contacts and platform activity.','Gérez les entreprises, les contacts et l’activité de la plateforme.')}</span><ArrowRight size={16} aria-hidden/></Link>}
  {next&&<section className="ws-card ws-onboarding" aria-labelledby="ws-onboarding-title">
   <div className="ws-onboarding-head"><div><h2 id="ws-onboarding-title">{l('Get started','Bien démarrer')}</h2><p>{l('{done} of {total} steps completed','{done} sur {total} étapes terminées').replace('{done}',String(done)).replace('{total}',String(steps.length))}</p></div><div className="ws-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={l('Get started','Bien démarrer')}><span style={{width:(done/steps.length*100)+'%'}}/></div></div>
   <ol>{steps.map(step=><li key={step.title} className={step.done?'done':step===next?'next':''}><span className="ws-check" aria-hidden>{step.done&&<Check size={13}/>}</span><div><strong>{step.title}</strong>{!step.done&&<p>{step.text}</p>}</div>{!step.done&&step.href&&<Link className={'ui-btn '+(step===next?'ui-btn-primary':'ui-btn-secondary')+' ui-btn-sm'} href={step.href}>{step.action}</Link>}{step.done&&<span className="ws-sr">{l('Completed','Terminé')}</span>}</li>)}</ol>
  </section>}
  <div className="ws-columns">
   <section className="ws-card" aria-labelledby="ws-requests-title">
    <div className="ws-card-head"><h2 id="ws-requests-title">{l('Recent requests','Demandes récentes')}</h2><Link href="/operations">{l('View all','Tout voir')}<ArrowRight size={15} aria-hidden/></Link></div>
    {data.requests.length?<ul className="ws-list">{data.requests.map(r=><li key={r.id}><Link href={'/operations?organization='+requestOrganization(r)+'&request='+r.id}><span className="ws-list-icon" aria-hidden><FileText size={17}/></span><span className="ws-list-text"><strong>{r.title||l('Untitled draft','Brouillon sans titre')}</strong><small>{when(r.updated_at)}</small></span>{badge(r.state)}</Link></li>)}</ul>:<div className="ws-empty"><FileText size={22} aria-hidden/><strong>{l('No request yet','Aucune demande pour le moment')}</strong><p>{l('Start with a guided questionnaire or a custom request.','Commencez avec le questionnaire guidé ou une demande personnalisée.')}</p><Link className="ui-btn ui-btn-secondary ui-btn-sm" href="/decrire-mon-besoin">{l('Describe my requirement','Décrire mon besoin')}</Link></div>}
   </section>
   <section className="ws-card" aria-labelledby="ws-conversations-title">
    <div className="ws-card-head"><h2 id="ws-conversations-title">{l('Conversations','Conversations')}</h2><Link href="/messagerie">{l('Open inbox','Ouvrir la messagerie')}<ArrowRight size={15} aria-hidden/></Link></div>
    {data.conversations.length?<ul className="ws-list">{data.conversations.map(c=>{const organization=data.organizations.find(o=>[c.buyer_organization_id,c.supplier_organization_id].includes(o.id))?.id||'';return <li key={c.id}><Link href={'/messagerie?organization='+organization+'&conversation='+c.id}><span className="ws-list-icon" aria-hidden><MessageSquare size={17}/></span><span className="ws-list-text"><strong>{c.product_name}</strong><small>{when(c.updated_at)}</small></span><ArrowRight className="ws-list-arrow" size={16} aria-hidden/></Link></li>})}</ul>:<div className="ws-empty"><MessageSquare size={22} aria-hidden/><strong>{l('No conversation yet','Aucune conversation pour le moment')}</strong><p>{l('Open a product to contact its manufacturer.','Ouvrez une fiche produit pour contacter son fabricant.')}</p><Link className="ui-btn ui-btn-secondary ui-btn-sm" href="/catalogue">{l('Browse products','Consulter les produits')}</Link></div>}
   </section>
  </div>
  <section className="ws-card ws-company" aria-labelledby="ws-company-title">
   <span className="ws-company-icon" aria-hidden><Factory size={20}/></span>
   <div className="ws-company-text">
    <h2 id="ws-company-title">{data.application?.name||l('Your company','Votre entreprise')}</h2>
    {data.application?<p>{badge(data.application.status)}<span>{data.application.products} {l('products in your catalogue.','produits dans votre catalogue.')}</span></p>:<p><span>{l('You manufacture? Present your company and your products to European buyers.','Vous fabriquez ? Présentez votre entreprise et vos produits aux acheteurs européens.')}</span></p>}
   </div>
   <div className="ws-actions"><Link className="ui-btn ui-btn-secondary" href="/mes-produits"><Package size={16} aria-hidden/>{l('Manage my products','Gérer mes produits')}</Link><Link className="ui-btn ui-btn-secondary" href="/espace-fournisseur">{data.application?l('Edit my company','Modifier mon entreprise'):l('Present my company','Présenter mon entreprise')}</Link></div>
  </section>
 </main>;
}
