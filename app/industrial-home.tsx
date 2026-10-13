'use client';
import HomeCatalogue from './home-catalogue';
import HeroVideo from './hero-video';
import {roboticsFamilies} from '@/lib/robotics';
import {ArrowRight,ArrowUpRight,Factory,Package,Layers,ClipboardList} from 'lucide-react';
import {ProductTile,SupplierTile,type Actions} from './discovery';
import {useLanguage} from './language';
import Link from '@/components/site-link';
import {products,suppliers,sectors} from '@/lib/catalog';
import {localText} from '@/lib/catalog-languages';
export default function IndustrialHome({actions,live=false}:{actions:Actions;live?:boolean}){
 const {l,language}=useLanguage();
 return <main className="industrial-home gsl-home">
 <section className="hx-hero" aria-labelledby="hx-title">
  <HeroVideo/>
  <div className="hx-content container">
   <div className="hx-intro">
    <p className="hx-eyebrow">{l('B2B sourcing · Robotics','Sourcing B2B · Robotique')}</p>
    <h1 id="hx-title">{l('Find the right manufacturers for your robotics components.','Les bons fabricants pour vos composants robotiques.')}</h1>
    <p className="hx-lead">{l('GSL supports you from manufacturer selection to a quote with delivery to Europe.','GSL vous accompagne du choix du fabricant au devis avec livraison en Europe.')}</p>
    <div className="hx-actions">
     <Link className="hx-primary" href={(live?'':'/demo')+'/fabricants'}>{l('Find a manufacturer','Trouver un fabricant')}<ArrowRight size={18} aria-hidden="true"/></Link>
     <Link className="hx-secondary" href="/decrire-mon-besoin">{l('Get a quote with delivery','Obtenir un devis avec livraison')}<ArrowRight size={18} aria-hidden="true"/></Link>
    </div>
    <div className="hx-context"><Link href="/pays">{l('10 countries outside the European Union','10 pays hors Union européenne')}</Link><span aria-hidden="true">·</span><Link href="/transport-importation">{l('Transport subject to review','Transport sur étude')}</Link></div>
   </div>
  </div>
 </section>
 <nav className="hx-components container" aria-labelledby="hx-components-title">
  <h2 id="hx-components-title">{l('Which component do you need?','Quel composant recherchez-vous ?')}</h2>
  <ul>{roboticsFamilies.map(f=><li key={f.id}><Link href={(live?'':'/demo')+'/catalogue?category='+f.id}><span>{l(f.en,f.fr)}</span><ArrowUpRight size={17} aria-hidden="true"/></Link></li>)}</ul>
 </nav>

 {live?<><HomeCatalogue/><section className="container gsl-section"><div className="gsl-section-head"><h2>{l('Sourcing robotics components','Sourcer des composants robotiques')}</h2><Link href="/guides">{l('Guides and resources','Guides et ressources')} <ArrowRight size={18}/></Link></div><div className="gsl-guide-grid hx-guides">{[['/notre-methode',l('How an offer is admitted','Comment une offre est admise'),l('A robotics product actually manufactured, an identified production site outside the EU and dated sources.','Un produit robotique réellement fabriqué, un site de production identifié hors UE et des sources datées.')],['/decrire-mon-besoin',l('Specify a joint or a component','Spécifier une articulation ou un composant'),l('Torque, speed, backlash, interfaces, quantities and delivery date.','Couple, vitesse, jeu, interfaces, quantités et date de livraison.')],['/guides',l('EU rules for robot components','Règles UE pour les composants de robots'),l('The Machinery Regulation (EU) 2023/1230 applies from 20 January 2027. Identify the evidence to request.','Le règlement Machines (UE) 2023/1230 s’applique dès le 20 janvier 2027. Identifiez les preuves à demander.')]].map(([href,title,body])=><Link key={href} href={href}><h3>{title}</h3><p>{body}</p><ArrowUpRight size={20}/></Link>)}</div></section></>:<>
 <section className="container gsl-section" id="products"><div className="gsl-section-head"><div><h2 className="gsl-icon-heading"><Package size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Product catalogue','Catalogue produits')}</h2><p>{l('Open a product to explore its materials, manufacturing process and example quantities.','Ouvrez une fiche pour consulter les matières, le procédé et les volumes de l’exemple.')}</p></div><Link href="/catalogue">{l('All products','Tous les produits')}<ArrowRight size={18}/></Link></div><p className="gsl-demo-note">{l('Catalogue preview: fictional products and companies, illustrative photographs.','Aperçu du catalogue : produits et entreprises fictifs, photographies d’illustration.')}</p><div className="discovery-grid">{[products[0],products[6],products[5]].map(p=><ProductTile key={p.id} product={p} actions={actions}/>)}</div></section>
 <section className="gsl-sectors"><div className="container"><div className="gsl-section-head"><div><h2 className="gsl-icon-heading"><Layers size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Browse by industry','Rechercher par secteur')}</h2></div><Link href="/secteurs">{l('All industries','Tous les secteurs')}<ArrowRight size={18}/></Link></div><div className="gsl-sector-grid">{sectors.map(s=><Link href={'/catalogue?secteur='+s.id} key={s.id}><strong>{localText(s.name,language)}</strong><ArrowUpRight size={20}/></Link>)}</div></div></section>
 <section className="container gsl-section" id="suppliers"><div className="gsl-section-head"><div><h2 className="gsl-icon-heading"><Factory size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Manufacturer directory','Annuaire des fabricants')}</h2><p>{l('Compare processes, locations and production examples before preparing your request.','Comparez les procédés, les implantations et les exemples de fabrication avant de préparer votre demande.')}</p></div><Link href="/fabricants">{l('All manufacturers','Tous les fabricants')}<ArrowRight size={18}/></Link></div><p className="gsl-demo-note">{l('Example profiles. No supplier identity or certification has been verified for these fictional companies.','Profils d’exemple. Aucune identité ni certification vérifiée pour ces entreprises fictives.')}</p><div className="discovery-suppliers-grid">{[suppliers[0],suppliers[4],suppliers[5]].map(s=><SupplierTile key={s.id} supplier={s}/>)}</div></section>
 </>}
 {!live&&<section className="gsl-method"><div className="container gsl-method-layout"><div><h2 className="gsl-icon-heading"><ClipboardList size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Prepare your manufacturing enquiry','Préparer votre demande de fabrication')}</h2><p>{l('GSL helps structure your industrial sourcing. Company review and product compliance are separate checks.','GSL vous aide à structurer votre recherche industrielle. L’examen d’une entreprise et la conformité d’un produit sont deux contrôles distincts.')}</p><Link href="/notre-methode">{l('Understand our method','Comprendre notre méthode')}<ArrowRight size={18}/></Link></div><ol>{[[l('Define the part','Définir la pièce'),l('Drawing, material, finish, quantity and delivery destination.','Plan, matière, finition, quantité et lieu de livraison.')],[l('Assess the manufacturer','Examiner le fabricant'),l('Business identity, production capabilities and documents covering the exact requirement.','Identité, moyens de production et documents correspondant au besoin précis.')],[l('Prepare the enquiry','Préparer la demande'),l('Review the recipient and the information shared before sending.','Vérifier le destinataire et les informations partagées avant tout envoi.')]].map(([title,text])=><li key={title}><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div></section>}
 <section className="container gsl-join hx-join"><div><h2>{l('Do you manufacture robotics components?','Vous fabriquez des composants robotiques ?')}</h2><p>{l('Document your robotics offer, production site and technical specifications for review by GSL.','Documentez votre offre robotique, votre site de production et vos caractéristiques techniques pour leur examen par GSL.')}</p><Link className="button-link" href="/inscription?next=%2Fespace-fournisseur">{l('Create my supplier profile','Créer mon profil fournisseur')}<ArrowRight size={18}/></Link></div></section>
 </main>
}
