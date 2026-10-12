'use client';
import {sourcingCountries} from '@/lib/sourcing-coverage';
import {countryName} from '@/lib/country-names';
import HomeCatalogue from './home-catalogue';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,Search,Pause,Play,Factory,Package,Layers,ClipboardList} from 'lucide-react';
import {ProductTile,SupplierTile,type Actions} from './discovery';
import {useLanguage} from './language';
import Link from '@/components/site-link';
import BrandLogo from '@/components/brand-logo';
import {products,suppliers,sectors} from '@/lib/catalog';
import {localText} from '@/lib/catalog-languages';
export default function IndustrialHome({actions,live=false}:{actions:Actions;live?:boolean}){
 const {l,language}=useLanguage();
 const [searchMode,setSearchMode]=useState('products');

 const video=useRef<HTMLVideoElement>(null),[playing,setPlaying]=useState(false),[src,setSrc]=useState('');
 const film=()=>matchMedia('(max-width: 760px)').matches?'/media/industrial-mobile.mp4?v=2':'/media/industrial-desktop.mp4?v=2';
 useEffect(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
  if(reduce.matches||connection?.saveData||connection?.effectiveType==='2g')return;
  // Request the film only after the page is usable. The poster remains visible.
  const timer=window.setTimeout(()=>setSrc(film()),1000);
  const stop=()=>{if(reduce.matches){clearTimeout(timer);video.current?.pause()}};reduce.addEventListener('change',stop);
  return()=>{clearTimeout(timer);reduce.removeEventListener('change',stop)};
 },[]);
 useEffect(()=>{if(src)video.current?.play().catch(()=>setPlaying(false))},[src]);
 function toggle(){if(playing){video.current?.pause();return}if(!src)setSrc(film());else video.current?.play().catch(()=>setPlaying(false))}
 return <main className="industrial-home gsl-home">
 <section className="hx-hero" aria-label={l('Find manufacturers','Recherche de fabricants')}>
  <div className="hx-media"><img src="/media/industrial-poster.jpg?v=2" alt={l('Close-up of a CNC lathe machining a metal part — illustration','Gros plan d’un tour CNC usinant une pièce métallique — illustration')} fetchPriority="high"/><video ref={video} src={src||undefined} muted playsInline loop preload="none" aria-hidden="true" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>setPlaying(false)}/><div className="hx-shade"/></div>
  <div className="hx-content container">
   <h1>{l('Find manufacturers for your robotics projects.','Trouvez les fabricants pour vos projets robotiques.')}</h1>
   <p className="hx-lead">{l('Compare non-EU manufacturers of robots, components and assemblies for robotics. Explore documented capabilities and the framework for trade with the European Union.','Comparez des fabricants hors UE de robots, composants et sous-ensembles pour la robotique. Consultez leurs capacités documentées et le cadre des échanges avec l’Union européenne.')}</p>
   <div className="hx-search">
    <div className="hx-modes" role="group" aria-label={l('Search type','Type de recherche')}>{[['products',l('Products','Produits')],['suppliers',l('Manufacturers','Fabricants')]].map(([value,label])=><button key={value} type="button" aria-pressed={searchMode===value} onClick={()=>setSearchMode(value)}>{value==='suppliers'?<Factory size={17} aria-hidden="true"/>:<Package size={17} aria-hidden="true"/>}{label}</button>)}</div>
    <form className="hx-form" action={(live?'':'/demo')+(searchMode==='products'?'/catalogue':'/fabricants')}><input type="hidden" name="lang" value={language}/>
     <label className="hx-field"><Search size={20} aria-hidden="true"/><input name="q" aria-label={l('Your search','Votre recherche')} placeholder={searchMode==='products'?l('Gripper, servo motor, force sensor…','Préhenseur, servomoteur, capteur de force…'):l('Company, process or city…','Entreprise, procédé ou ville…')}/></label>
     <select name="country" aria-label={l('Manufacturing country','Pays de fabrication')}><option value="">{l('All countries','Tous les pays')}</option>{sourcingCountries.map(c=><option value={c} key={c}>{countryName(c,language)}</option>)}</select>
     <button type="submit">{l('Find a manufacturer','Trouver un fabricant')}<ArrowRight size={18} aria-hidden="true"/></button>
    </form>
   </div>
   <Link className="hx-project-cta" href="/decrire-mon-besoin">{l('Describe my robotics project','Décrire mon projet robotique')}<ArrowRight size={18}/></Link>
  </div>
  <button type="button" className="hx-play" onClick={toggle} aria-label={playing?l('Pause film','Mettre la vidéo en pause'):l('Play film','Lire la vidéo')}>{playing?<Pause size={16} aria-hidden="true"/>:<Play size={16} aria-hidden="true"/>}</button>
 </section>

 {live?<><HomeCatalogue/><section className="container gsl-section"><div className="gsl-section-head"><h2>{l('Prepare your sourcing','Préparer vos achats')}</h2><Link href="/guides">{l('Guides and resources','Guides et ressources')} <ArrowRight size={18}/></Link></div><div className="gsl-guide-grid hx-guides">{[['/notre-methode',l('Assess a manufacturer','Examiner un fabricant'),l('Identity, production locations and the scope of supporting documents.','Identité, sites de production et périmètre des justificatifs.')],['/decrire-mon-besoin',l('Prepare a useful enquiry','Préparer une demande exploitable'),l('Drawings, material, quantities and delivery requirements.','Plans, matière, quantités et conditions de livraison.')],['/guides',l('Understand product compliance','Comprendre la conformité produit'),l('Identify the evidence relevant to your product and its intended use.','Identifier les preuves adaptées à votre produit et à son utilisation.')]].map(([href,title,body])=><Link key={href} href={href}><h3>{title}</h3><p>{body}</p><ArrowUpRight size={20}/></Link>)}</div></section></>:<>
 <section className="container gsl-section" id="products"><div className="gsl-section-head"><div><h2 className="gsl-icon-heading"><Package size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Product catalogue','Catalogue produits')}</h2><p>{l('Open a product to explore its materials, manufacturing process and example quantities.','Ouvrez une fiche pour consulter les matières, le procédé et les volumes de l’exemple.')}</p></div><Link href="/catalogue">{l('All products','Tous les produits')}<ArrowRight size={18}/></Link></div><p className="gsl-demo-note">{l('Catalogue preview: fictional products and companies, illustrative photographs.','Aperçu du catalogue : produits et entreprises fictifs, photographies d’illustration.')}</p><div className="discovery-grid">{[products[0],products[6],products[5]].map(p=><ProductTile key={p.id} product={p} actions={actions}/>)}</div></section>
 <section className="gsl-sectors"><div className="container"><div className="gsl-section-head"><div><h2 className="gsl-icon-heading"><Layers size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Browse by industry','Rechercher par secteur')}</h2></div><Link href="/secteurs">{l('All industries','Tous les secteurs')}<ArrowRight size={18}/></Link></div><div className="gsl-sector-grid">{sectors.map((s,i)=><Link href={'/catalogue?secteur='+s.id} key={s.id}><span className="gsl-sector-number">{String(i+1).padStart(2,'0')}</span><strong>{localText(s.name,language)}</strong><ArrowUpRight size={20}/></Link>)}</div></div></section>
 <section className="container gsl-section" id="suppliers"><div className="gsl-section-head"><div><h2 className="gsl-icon-heading"><Factory size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Manufacturer directory','Annuaire des fabricants')}</h2><p>{l('Compare processes, locations and production examples before preparing your request.','Comparez les procédés, les implantations et les exemples de fabrication avant de préparer votre demande.')}</p></div><Link href="/fabricants">{l('All manufacturers','Tous les fabricants')}<ArrowRight size={18}/></Link></div><p className="gsl-demo-note">{l('Example profiles. No supplier identity or certification has been verified for these fictional companies.','Profils d’exemple. Aucune identité ni certification vérifiée pour ces entreprises fictives.')}</p><div className="discovery-suppliers-grid">{[suppliers[0],suppliers[4],suppliers[5]].map(s=><SupplierTile key={s.id} supplier={s}/>)}</div></section>
 </>}
 {!live&&<section className="gsl-method"><div className="container gsl-method-layout"><div><h2 className="gsl-icon-heading"><ClipboardList size={25} strokeWidth={1.6} aria-hidden="true"/>{l('Prepare your manufacturing enquiry','Préparer votre demande de fabrication')}</h2><p>{l('GSL helps structure your industrial sourcing. Company review and product compliance are separate checks.','GSL vous aide à structurer votre recherche industrielle. L’examen d’une entreprise et la conformité d’un produit sont deux contrôles distincts.')}</p><Link href="/notre-methode">{l('Understand our method','Comprendre notre méthode')}<ArrowRight size={18}/></Link></div><ol>{[[l('Define the part','Définir la pièce'),l('Drawing, material, finish, quantity and delivery destination.','Plan, matière, finition, quantité et lieu de livraison.')],[l('Assess the manufacturer','Examiner le fabricant'),l('Business identity, production capabilities and documents covering the exact requirement.','Identité, moyens de production et documents correspondant au besoin précis.')],[l('Prepare the enquiry','Préparer la demande'),l('Review the recipient and the information shared before sending.','Vérifier le destinataire et les informations partagées avant tout envoi.')]].map(([title,text],i)=><li key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div></section>}
 <section className="container gsl-join hx-join"><div><h2>{l('Do you manufacture for robotics?','Vous fabriquez pour la robotique ?')}</h2><p>{l('Document your robotics offer, production site and technical specifications for review by GSL.','Documentez votre offre robotique, votre site de production et vos caractéristiques techniques pour leur examen par GSL.')}</p><Link className="button-link" href="/inscription?next=%2Fespace-fournisseur">{l('Create my supplier profile','Créer mon profil fournisseur')}<ArrowRight size={18}/></Link></div><div className="gsl-join-mark" aria-hidden="true"><BrandLogo/></div></section>
 </main>
}
