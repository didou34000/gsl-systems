'use client';
import {sourcingCountries} from '@/lib/sourcing-coverage';
import {countryName} from '@/lib/country-names';
import HomeCatalogue from './home-catalogue';
import {useState} from 'react';
import {roboticsFamilies} from '@/lib/robotics';
import {ArrowRight,ArrowUpRight,Search,Factory,Package,Layers,ClipboardList,Cog} from 'lucide-react';
import {ProductTile,SupplierTile,type Actions} from './discovery';
import {useLanguage} from './language';
import Link from '@/components/site-link';
import {products,suppliers,sectors} from '@/lib/catalog';
import {localText} from '@/lib/catalog-languages';
export default function IndustrialHome({actions,live=false}:{actions:Actions;live?:boolean}){
 const {l,language}=useLanguage();
 const [searchMode,setSearchMode]=useState('products');
 return <main className="industrial-home gsl-home">
 <section className="hx-hero" aria-labelledby="hx-title">
  <div className="hx-content container">
   <div className="hx-intro">
    <h1 id="hx-title">{l('Components for humanoid robots.','Les composants de vos robots humanoïdes.')}</h1>
    <p className="hx-lead">{l('Actuators, reducers, sensors, hands and control electronics. Compare documented manufacturers outside the EU and send a precise technical enquiry.','Actionneurs, réducteurs, capteurs, mains et électronique de commande. Comparez des fabricants hors UE documentés et envoyez une demande technique précise.')}</p>
    <div className="hx-search">
     <div className="hx-modes" role="group" aria-label={l('Search type','Type de recherche')}>{[['products',l('Components','Composants')],['suppliers',l('Manufacturers','Fabricants')]].map(([value,label])=><button key={value} type="button" aria-pressed={searchMode===value} onClick={()=>setSearchMode(value)}>{value==='suppliers'?<Factory size={17} aria-hidden="true"/>:<Cog size={17} aria-hidden="true"/>}{label}</button>)}</div>
     <form className="hx-form" action={(live?'':'/demo')+(searchMode==='products'?'/catalogue':'/fabricants')}><input type="hidden" name="lang" value={language}/>
      <label className="hx-field"><Search size={20} aria-hidden="true"/><input name="q" aria-label={l('Your search','Votre recherche')} placeholder={searchMode==='products'?l('Harmonic reducer, joint actuator, torque sensor…','Réducteur harmonique, actionneur articulaire, capteur de couple…'):l('Company, process or city…','Entreprise, procédé ou ville…')}/></label>
      <select name="country" aria-label={l('Manufacturing country','Pays de fabrication')}><option value="">{l('All countries','Tous les pays')}</option>{sourcingCountries.map(c=><option value={c} key={c}>{countryName(c,language)}</option>)}</select>
      <button type="submit">{l('Search','Rechercher')}<ArrowRight size={18} aria-hidden="true"/></button>
     </form>
    </div>
    <Link className="hx-project-cta" href="/decrire-mon-besoin">{l('Describe my robotics project','Décrire mon projet robotique')}<ArrowRight size={18} aria-hidden="true"/></Link>
   </div>
   <nav className="hx-anatomy" aria-labelledby="hx-anatomy-title">
    <h2 id="hx-anatomy-title">{l('What a humanoid robot is built from','Ce qui compose un robot humanoïde')}</h2>
    <ul>{roboticsFamilies.map(f=><li key={f.id}><Link href={(live?'':'/demo')+'/catalogue?category='+f.id}><span><strong>{l(f.en,f.fr)}</strong><small>{l(f.examplesEn,f.examplesFr)}</small></span><ArrowUpRight size={18} aria-hidden="true"/></Link></li>)}</ul>
   </nav>
  </div>
 </section>

 {live?<><HomeCatalogue/><section className="container gsl-section"><div className="gsl-section-head"><h2>{l('Sourcing robotics components','Sourcer des composants robotiques')}</h2><Link href="/guides">{l('Guides and resources','Guides et ressources')} <ArrowRight size={18}/></Link></div><div className="gsl-guide-grid hx-guides">{[['/notre-methode',l('How an offer is admitted','Comment une offre est admise'),l('A robotics product actually manufactured, an identified production site outside the EU and dated sources.','Un produit robotique réellement fabriqué, un site de production identifié hors UE et des sources datées.')],['/decrire-mon-besoin',l('Specify a joint or a component','Spécifier une articulation ou un composant'),l('Torque, speed, backlash, interfaces, quantities and delivery date.','Couple, vitesse, jeu, interfaces, quantités et date de livraison.')],['/guides',l('EU rules for robot components','Règles UE pour les composants de robots'),l('The Machinery Regulation (EU) 2023/1230 applies from 20 January 2027. Identify the evidence to request.','Le règlement Machines (UE) 2023/1230 s’applique dès le 20 janvier 2027. Identifiez les preuves à demander.')]].map(([href,title,body])=><Link key={href} href={href}><h3>{title}</h3><p>{body}</p><ArrowUpRight size={20}/></Link>)}</div></section></>:<>
 <section className="container gsl-section" id="products"><div className="gsl-section-head"><div><h2 className="gsl-icon-heading"><Package size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Product catalogue','Catalogue produits')}</h2><p>{l('Open a product to explore its materials, manufacturing process and example quantities.','Ouvrez une fiche pour consulter les matières, le procédé et les volumes de l’exemple.')}</p></div><Link href="/catalogue">{l('All products','Tous les produits')}<ArrowRight size={18}/></Link></div><p className="gsl-demo-note">{l('Catalogue preview: fictional products and companies, illustrative photographs.','Aperçu du catalogue : produits et entreprises fictifs, photographies d’illustration.')}</p><div className="discovery-grid">{[products[0],products[6],products[5]].map(p=><ProductTile key={p.id} product={p} actions={actions}/>)}</div></section>
 <section className="gsl-sectors"><div className="container"><div className="gsl-section-head"><div><h2 className="gsl-icon-heading"><Layers size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Browse by industry','Rechercher par secteur')}</h2></div><Link href="/secteurs">{l('All industries','Tous les secteurs')}<ArrowRight size={18}/></Link></div><div className="gsl-sector-grid">{sectors.map(s=><Link href={'/catalogue?secteur='+s.id} key={s.id}><strong>{localText(s.name,language)}</strong><ArrowUpRight size={20}/></Link>)}</div></div></section>
 <section className="container gsl-section" id="suppliers"><div className="gsl-section-head"><div><h2 className="gsl-icon-heading"><Factory size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Manufacturer directory','Annuaire des fabricants')}</h2><p>{l('Compare processes, locations and production examples before preparing your request.','Comparez les procédés, les implantations et les exemples de fabrication avant de préparer votre demande.')}</p></div><Link href="/fabricants">{l('All manufacturers','Tous les fabricants')}<ArrowRight size={18}/></Link></div><p className="gsl-demo-note">{l('Example profiles. No supplier identity or certification has been verified for these fictional companies.','Profils d’exemple. Aucune identité ni certification vérifiée pour ces entreprises fictives.')}</p><div className="discovery-suppliers-grid">{[suppliers[0],suppliers[4],suppliers[5]].map(s=><SupplierTile key={s.id} supplier={s}/>)}</div></section>
 </>}
 {!live&&<section className="gsl-method"><div className="container gsl-method-layout"><div><h2 className="gsl-icon-heading"><ClipboardList size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Prepare your manufacturing enquiry','Préparer votre demande de fabrication')}</h2><p>{l('GSL helps structure your industrial sourcing. Company review and product compliance are separate checks.','GSL vous aide à structurer votre recherche industrielle. L’examen d’une entreprise et la conformité d’un produit sont deux contrôles distincts.')}</p><Link href="/notre-methode">{l('Understand our method','Comprendre notre méthode')}<ArrowRight size={18}/></Link></div><ol>{[[l('Define the part','Définir la pièce'),l('Drawing, material, finish, quantity and delivery destination.','Plan, matière, finition, quantité et lieu de livraison.')],[l('Assess the manufacturer','Examiner le fabricant'),l('Business identity, production capabilities and documents covering the exact requirement.','Identité, moyens de production et documents correspondant au besoin précis.')],[l('Prepare the enquiry','Préparer la demande'),l('Review the recipient and the information shared before sending.','Vérifier le destinataire et les informations partagées avant tout envoi.')]].map(([title,text])=><li key={title}><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div></section>}
 <section className="container gsl-join hx-join"><div><h2>{l('Do you manufacture robotics components?','Vous fabriquez des composants robotiques ?')}</h2><p>{l('Document your robotics offer, production site and technical specifications for review by GSL.','Documentez votre offre robotique, votre site de production et vos caractéristiques techniques pour leur examen par GSL.')}</p><Link className="button-link" href="/inscription?next=%2Fespace-fournisseur">{l('Create my supplier profile','Créer mon profil fournisseur')}<ArrowRight size={18}/></Link></div></section>
 </main>
}
