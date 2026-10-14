'use client';
import {useState,type FormEvent} from 'react';
import HomeCatalogue from './home-catalogue';
import HeroVideo from './hero-video';
import {roboticsFamilies} from '@/lib/robotics';
import {sourcingCountries} from '@/lib/sourcing-coverage';
import {europeCountries} from '@/lib/europe-trade';
import {languageOptions} from '@/lib/i18n/languages';
import {countryName} from '@/lib/country-names';
import {ArrowRight,Factory,Package,Search} from 'lucide-react';
import {ProductTile,SupplierTile,type Actions} from './discovery';
import {CategoryIcon} from './catalogue-cards';
import {useLanguage} from './language';
import Link from '@/components/site-link';
import {products,suppliers} from '@/lib/catalog';
import {homeImages} from '@/lib/home-images';

function HomeSearch({base}:{base:string}){
 const {l,language}=useLanguage();
 const [target,setTarget]=useState<'catalogue'|'fabricants'>('catalogue');
 const [query,setQuery]=useState('');
 function submit(event:FormEvent){
  event.preventDefault();
  const params=new URLSearchParams();
  if(query.trim())params.set('q',query.trim());
  if(language!=='en')params.set('lang',language);
  const search=params.toString();
  window.location.assign(base+'/'+target+(search?'?'+search:''));
 }
 return <section className="hx-search container" aria-labelledby="hx-search-title">
  <h2 id="hx-search-title">{l('What are you looking for?','Que recherchez-vous ?')}</h2>
  <form onSubmit={submit}>
   <div className="hx-search-kind" role="radiogroup" aria-label={l('Search type','Type de recherche')}>
    <label className={target==='catalogue'?'is-active':undefined}><input type="radio" name="hx-kind" value="catalogue" checked={target==='catalogue'} onChange={()=>setTarget('catalogue')}/><Package size={16} aria-hidden/>{l('A component','Un composant')}</label>
    <label className={target==='fabricants'?'is-active':undefined}><input type="radio" name="hx-kind" value="fabricants" checked={target==='fabricants'} onChange={()=>setTarget('fabricants')}/><Factory size={16} aria-hidden/>{l('A manufacturer or supplier','Un fabricant ou un fournisseur')}</label>
   </div>
   <div className="hx-search-field">
    <Search size={20} aria-hidden/>
    <input value={query} onChange={e=>setQuery(e.target.value)} maxLength={120} aria-label={target==='catalogue'?l('Component, reference or criterion','Composant, référence ou critère'):l('Company name or speciality','Nom ou spécialité de l’entreprise')} placeholder={target==='catalogue'?l('Harmonic reducer, joint actuator, encoder…','Réducteur harmonique, actionneur articulaire, codeur…'):l('Company name, speciality or country…','Nom, spécialité ou pays de l’entreprise…')}/>
    <button type="submit">{l('Search','Rechercher')}<ArrowRight size={17} aria-hidden/></button>
   </div>
  </form>
 </section>;
}

function KeyFigures(){
 const {l}=useLanguage();
 const figures=[
  [String(sourcingCountries.length),l('manufacturing countries outside the EU','pays de fabrication hors UE'),'/pays'],
  [String(roboticsFamilies.length),l('component families','familles de composants'),'/secteurs'],
  [String(europeCountries.length),l('European countries documented','pays d’Europe documentés'),'/pays'],
  [String(languageOptions.length),l('languages available','langues disponibles'),''],
 ];
 return <section className="hx-figures" aria-labelledby="hx-figures-title" style={homeImages.figures?{backgroundImage:`linear-gradient(90deg,rgba(15,27,38,.94),rgba(15,27,38,.72)),url("${homeImages.figures}")`}:undefined}>
  <div className="container">
   <h2 id="hx-figures-title" className="sr-only">{l('GSL in figures','GSL en chiffres')}</h2>
   <ul>{figures.map(([value,label,href])=><li key={label}>{href?<Link href={href}><strong>{value}</strong><span>{label}</span></Link>:<><strong>{value}</strong><span>{label}</span></>}</li>)}</ul>
   <Link className="hx-figures-cta" href="/decrire-mon-besoin">{l('Get several quotes','Obtenez plusieurs devis')}<ArrowRight size={18} aria-hidden/></Link>
  </div>
 </section>;
}

function ClosingBand(){
 const {l}=useLanguage();
 return <section className={'hx-closing container'+(homeImages.person?' has-photo':'')} aria-labelledby="hx-closing-title">
  {homeImages.person&&<img src={homeImages.person} alt="" width={560} height={560} loading="lazy" decoding="async"/>}
  <div>
   <h2 id="hx-closing-title">{l('One contact, from the first enquiry to the quote.','Un seul interlocuteur, de la première demande au devis.')}</h2>
   <p>{l('Describe your requirement once. GSL helps you choose manufacturers, prepare a precise enquiry and compare quotes with delivery to Europe.','Décrivez votre besoin une fois. GSL vous aide à choisir les fabricants, à préparer une demande précise et à comparer des devis avec livraison en Europe.')}</p>
   <div className="hx-closing-actions"><Link className="hx-closing-primary" href="/decrire-mon-besoin">{l('Describe my requirement','Décrire mon besoin')}<ArrowRight size={18} aria-hidden/></Link><Link href="/contact">{l('Contact us','Nous contacter')}</Link></div>
  </div>
 </section>;
}

export default function IndustrialHome({actions,live=false}:{actions:Actions;live?:boolean}){
 const {l,language}=useLanguage();
 const base=live?'':'/demo';
 return <main className="industrial-home gsl-home">
 <section className="hx-hero" aria-labelledby="hx-title">
  <HeroVideo/>
  <div className="hx-content container">
   <div className="hx-intro">
    <p className="hx-eyebrow">{l('B2B sourcing · Robotics','Sourcing B2B · Robotique')}</p>
    <h1 id="hx-title">{l('Find the right manufacturers for your robotics components.','Les bons fabricants pour vos composants robotiques.')}</h1>
    <p className="hx-lead">{l('GSL supports you from manufacturer selection to a quote with delivery to Europe.','GSL vous accompagne du choix du fabricant au devis avec livraison en Europe.')}</p>
    <div className="hx-actions">
     <Link className="hx-primary" href={base+'/fabricants'}>{l('Find a manufacturer','Trouver un fabricant')}<ArrowRight size={18} aria-hidden="true"/></Link>
     <Link className="hx-secondary" href="/decrire-mon-besoin">{l('Get a quote with delivery','Obtenir un devis avec livraison')}<ArrowRight size={18} aria-hidden="true"/></Link>
    </div>
   </div>
   <div className="hx-countries">
    <div><Link href="/pays">{l('Manufacturers in 10 countries outside the European Union','Fabricants dans 10 pays hors Union européenne')}</Link><ul>{sourcingCountries.map(code=><li key={code}>{countryName(code,language)}</li>)}</ul></div>
    <div><Link href="/pays">{l('Buyers and delivery in Europe','Acheteurs et livraison en Europe')}</Link><ul><li>{l('European Union','Union européenne')} {l('and the other European countries','et les autres pays d’Europe')}</li></ul></div>
   </div>
  </div>
 </section>
 <HomeSearch base={base}/>
 <nav className="hx-families container" aria-labelledby="hx-families-title">
  <div className="hx-section-head"><h2 id="hx-families-title">{l('Component families','Familles de composants')}</h2><Link href="/secteurs">{l('All families','Toutes les familles')}<ArrowRight size={17} aria-hidden/></Link></div>
  <ul>{roboticsFamilies.map(f=><li key={f.id}><Link href={base+'/catalogue?category='+f.id}><span className="hx-family-icon"><CategoryIcon category={f.id} size={24} strokeWidth={1.5}/></span><span>{l(f.en,f.fr)}</span></Link></li>)}</ul>
 </nav>

 {live?<HomeCatalogue/>:<>
 <section className="container gsl-section" id="products"><div className="gsl-section-head"><div><h2>{l('Product catalogue','Catalogue produits')}</h2></div><Link href="/catalogue">{l('All products','Tous les produits')}<ArrowRight size={18}/></Link></div><p className="gsl-demo-note">{l('Catalogue preview: fictional products and companies, illustrative photographs.','Aperçu du catalogue : produits et entreprises fictifs, photographies d’illustration.')}</p><div className="discovery-grid">{[products[0],products[6],products[5]].map(p=><ProductTile key={p.id} product={p} actions={actions}/>)}</div></section>
 <section className="container gsl-section" id="suppliers"><div className="gsl-section-head"><div><h2>{l('Manufacturer directory','Annuaire des fabricants')}</h2></div><Link href="/fabricants">{l('All manufacturers','Tous les fabricants')}<ArrowRight size={18}/></Link></div><p className="gsl-demo-note">{l('Example profiles. No supplier identity or certification has been verified for these fictional companies.','Profils d’exemple. Aucune identité ni certification vérifiée pour ces entreprises fictives.')}</p><div className="discovery-suppliers-grid">{[suppliers[0],suppliers[4],suppliers[5]].map(s=><SupplierTile key={s.id} supplier={s}/>)}</div></section>
 </>}
 <p className="hx-supplier-line container">{l('Do you manufacture robotics components?','Vous fabriquez des composants robotiques ?')} <Link href="/inscription?next=%2Fespace-fournisseur">{l('Create my supplier profile','Créer mon profil fournisseur')}<ArrowRight size={16} aria-hidden/></Link></p>
 <KeyFigures/>
 <ClosingBand/>
 </main>
}
