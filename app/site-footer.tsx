'use client';
import {useRef,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowRight,Globe2} from 'lucide-react';
import Link from '@/components/site-link';
import BrandLogo from '@/components/brand-logo';
import {useLanguage} from './language';
import {languageOptions} from '@/lib/i18n/languages';
import {roboticsFamilies} from '@/lib/robotics';
import {sourcingCountries} from '@/lib/sourcing-coverage';
import {countryName} from '@/lib/country-names';
import {socialLinks} from '@/lib/brand';

const LinkedInMark=()=><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>;
const InstagramMark=()=><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;

function Newsletter(){
 const {l,language}=useLanguage();
 const id=useRef('');
 const [state,setState]=useState<'idle'|'sending'|'done'|'error'|'limited'>('idle');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const form=new FormData(event.currentTarget);
  if(!id.current)id.current=crypto.randomUUID();
  setState('sending');
  try{
   const response=await fetch('/api/newsletter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:id.current,email:form.get('email'),consent:form.get('consent')==='on',website:form.get('website')||'',language})});
   setState(response.ok?'done':response.status===429?'limited':'error');
  }catch{setState('error')}
 }
 if(state==='done')return <p className="footer-newsletter-done" role="status">{l('Thank you. Your newsletter sign-up has been recorded.','Merci. Votre inscription à la newsletter est enregistrée.')}</p>;
 return <form className="footer-newsletter" onSubmit={submit}>
  <label htmlFor="footer-newsletter-email">{l('Newsletter: sourcing guides and new manufacturers','Newsletter : guides de sourcing et nouveaux fabricants')}</label>
  <div><input id="footer-newsletter-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder={l('Work email','E-mail professionnel')}/><button type="submit" disabled={state==='sending'}>{l('Subscribe','S’inscrire')}<ArrowRight size={16} aria-hidden/></button></div>
  <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="footer-trap"/>
  <label className="footer-consent"><input type="checkbox" name="consent" required/>{l('I agree to receive GSL news by email. I can unsubscribe at any time.','J’accepte de recevoir les actualités de GSL par e-mail. Je peux me désinscrire à tout moment.')} <Link href="/confidentialite">{l('Privacy','Confidentialité')}</Link></label>
  {state==='error'&&<p role="alert">{l('Sign-up is unavailable right now. Please try again later.','L’inscription est indisponible pour le moment. Réessayez plus tard.')}</p>}
  {state==='limited'&&<p role="alert">{l('Too many attempts. Please try again in an hour.','Trop de tentatives. Réessayez dans une heure.')}</p>}
 </form>;
}

export default function SiteFooter({signedIn,isDemo}:{signedIn:boolean;isDemo:boolean}){
 const {l,language}=useLanguage();
 const social=[['LinkedIn',socialLinks.linkedin,<LinkedInMark key="in"/>],['Instagram',socialLinks.instagram,<InstagramMark key="ig"/>]].filter(([,href])=>href) as [string,string,ReactNode][];
 return <><footer className="site-footer">
  <div className="container footer-top">
   <div className="footer-identity">
    <Link href="/" className="footer-brand" aria-label="GSL systems"><BrandLogo/></Link>
    <p>{l('Components for robotics.','Composants pour la robotique.')} {l('European buyers, manufacturers outside the EU.','Acheteurs européens, fabricants hors Union européenne.')}</p>
    {social.length>0&&<ul className="footer-social">{social.map(([name,href,icon])=><li key={name}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={name+' GSL systems'}>{icon}</a></li>)}</ul>}
   </div>
   <Newsletter/>
  </div>
  <div className="container footer-grid footer-grid-wide">
   <div><h3>{l('Buyers','Acheteurs')}</h3><Link href={signedIn?'/compte':'/connexion'}>{l('Buyer area','Espace acheteur')}</Link><Link href="/catalogue">{l('Browse products','Explorer le catalogue')}</Link><Link href="/decrire-mon-besoin">{l('Describe my requirement','Décrire mon besoin')}</Link><Link href="/comparateur">{l('Compare products','Comparer les produits')}</Link><Link href="/suivi">{l('Requests & delivery','Demandes et livraison')}</Link></div>
   <div><h3>{l('Manufacturers','Fabricants')}</h3><Link href={signedIn?'/espace-fournisseur':'/inscription?next=%2Fespace-fournisseur'}>{l('Become a supplier or manufacturer','Devenir fournisseur ou fabricant')}</Link><Link href="/espace-fournisseur">{l('Manufacturer area','Espace fabricant')}</Link>{signedIn&&<Link href="/mes-produits">{l('Manage my products','Gérer mes produits')}</Link>}<Link href="/demandes">{l('Buyer requests','Demandes d’achat')}</Link><Link href="/fabricants">{l('Manufacturer directory','Annuaire des fabricants')}</Link><Link href="/notre-methode">{l('Our method','Notre méthode')}</Link></div>
   <div><h3>{l('Component families','Familles de composants')}</h3>{roboticsFamilies.map(f=><Link key={f.id} href={'/catalogue?category='+f.id}>{l(f.en,f.fr)}</Link>)}</div>
   <div><h3>{l('Manufacturing countries','Pays de fabrication')}</h3>{sourcingCountries.map(code=><Link key={code} href={'/pays/'+code.toLowerCase()}>{countryName(code,language)}</Link>)}</div>
   <div><h3>GSL systems</h3>{!signedIn&&<Link href="/connexion">{l('Sign in','S’identifier')}</Link>}<Link href="/contact">{l('Contact','Contact')}</Link><Link href="/blog">{l('Blog','Blog')}</Link><Link href="/accompagnement">{l('Assisted sourcing','Sourcing accompagné')}</Link><Link href="/guides">{l('Guides & resources','Guides & ressources')}</Link><Link href="/calculateur">{l('Cost calculator','Calculateur de coût')}</Link><Link href="/aide">{l('Help centre','Centre d’aide')}</Link></div>
  </div>
  <div className="container footer-bottom"><span>{isDemo?l('© 2026 GSL systems · Demonstration','© 2026 GSL systems · Démonstration'):'© 2026 GSL systems'}</span><span className="footer-region"><Globe2 size={15} aria-hidden/>{languageOptions.find(option=>option.code===language)?.name} · EUR</span><Link href="/mentions-legales">{l('Legal notice','Mentions légales')}</Link><Link href="/conditions-utilisation">{l('Terms of use','Conditions d’utilisation')}</Link><Link href="/confidentialite">{l('Data & privacy','Données & confidentialité')}</Link><Link href="/cookies">{l('Cookies','Cookies')}</Link><Link href="/credits">{l('Credits','Crédits')}</Link><Link href="/informations">{l('About this version','À propos de cette version')}</Link></div>
 </footer></>;
}
