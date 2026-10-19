'use client';
import {useState} from 'react';
import Link from '@/components/site-link';
import CountryFlag from '@/components/country-flag';
import {countryName} from '@/lib/country-names';
import {technicalRows} from '@/lib/robotics';
import type {ProductImage} from '@/lib/referenced-makers';
import {formatSpecRow,publishedSpecificationRows,quantityUnitLabels,type PublishedRows} from '@/lib/products/spec-fields';
import {ArrowLeft,ArrowRight,ArrowUpRight,Factory,FileText,MapPin,MessageSquare} from 'lucide-react';
import {useLanguage} from './language';
import {SaveProduct} from './saved-selection';
import {CompareProduct} from './compare-product';
import {CategoryIcon,CompanyMark,ProductCard,useCategoryLabel} from './catalogue-cards';
import ProductPicture from './product-image';
import {productPhotoIds} from '@/lib/products/review';
import type {PublicProduct,PublicSupplier} from './public-profiles';
import './product-sheet.css';

type L=(en:string,fr:string)=>string;
type Row={key:string;label:string;value:string};
type Source={url:string;title:string};

// Shown in their own sections (commercial terms, compliance) or internal to the review: never repeated in the specification table.
const reserved=new Set(['minimum_quantity','unit','lead_time','manufacturing_country','robotics_site','verification','compliance','qualification','delivery_status','delivery_evidence','candidate_id','robotics_family','robotics_offer','robotics_checked_at','robotics_sources','research_data','photo_ids','points_to_confirm','production_evidence','certifications','certification_documented']);
/** Stored specification keys as labelled rows, robotics metrics first with their units. */
function fallbackSpecRows(p:PublicProduct,l:L):Row[]{
 const spec=p.specifications||{};const metrics=technicalRows(p.category,spec);const shown=new Set(metrics.map(m=>m.key));
 const labels:Record<string,string>={reference:l('Manufacturer reference','Référence fabricant'),materials:l('Material','Matière'),processes:l('Process','Procédé')};
 const rows:Row[]=metrics.map(m=>({key:m.key,label:l(m.en,m.fr),value:m.value+' '+m.unit}));
 for(const [key,raw] of Object.entries(spec)){
  if(reserved.has(key)||shown.has(key)||raw===null||raw===undefined)continue;
  const value=typeof raw==='string'?raw.trim():typeof raw==='number'||typeof raw==='boolean'?String(raw):'';if(!value)continue;
  rows.push({key,label:labels[key]||key.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()),value});
 }
 return rows;
}
/** Supplier-declared technical block (lib/products/spec-fields.ts) first, then any other stored value. */
function specificationRows(sheet:PublishedRows,p:PublicProduct,l:L,language:string):Row[]{
 const rows=sheet.rows.map(r=>({key:r.key,label:l(r.en,r.fr),value:formatSpecRow(r,language)}));const seen=new Set(rows.map(r=>r.key));
 return [...rows,...fallbackSpecRows(p,l).filter(r=>!seen.has(r.key))];
}

function sourcesOf(raw?:string):Source[]{if(!raw)return [];try{const list=JSON.parse(raw);return Array.isArray(list)?list.filter((x):x is Source=>!!x&&typeof x.url==='string'&&/^https?:\/\//.test(x.url)).map(x=>({url:x.url,title:typeof x.title==='string'&&x.title?x.title:x.url})):[]}catch{return []}}

function Gallery({images,name,category}:{images:ProductImage[];name:string;category:string}){
 const {l}=useLanguage();const [active,setActive]=useState(0);
 if(!images.length)return <div className="ps-gallery ps-gallery-empty"><CategoryIcon category={category} size={72} strokeWidth={1}/><p>{l('No photo published for this product','Aucune photo publiée pour ce produit')}</p></div>;
 const index=Math.min(active,images.length-1);
 return <div className="ps-gallery"><ProductPicture image={images[index]} alt={name}/>{images.length>1&&<div className="ps-thumbnails">{images.map((image,i)=><button key={image.src} type="button" aria-pressed={index===i} aria-label={l('Photo','Photo')+' '+(i+1)} onClick={()=>setActive(i)}><img src={image.src} alt="" loading="lazy"/></button>)}</div>}</div>;
}

export function ProductSheet({product:p,similar,manufacturer,makerProducts=[],images=[]}:{product:PublicProduct;similar:PublicProduct[];manufacturer?:PublicSupplier|null;makerProducts?:PublicProduct[];images?:ProductImage[]}){
 const {l,language}=useLanguage();const categoryLabel=useCategoryLabel();const spec=p.specifications||{};
 const supplierPhotos=productPhotoIds(spec.photo_ids).map(id=>({src:'/api/product-images?id='+id,kind:'manufacturer' as const,credit:manufacturer?.display_name||l('Manufacturer','Fabricant'),license:l('Publication authorised by the supplier','Publication autorisée par le fournisseur'),sourceUrl:'/produits/'+p.product_id}));
 const robotics=!!spec.robotics_family;const candidate=!!spec.candidate_id;const admitted=p.catalogue_status!=='not_admitted';
 const sheet=publishedSpecificationRows(p);const description=sheet.description.trim();const sources=sourcesOf(spec.robotics_sources);const rows=specificationRows(sheet,p,l,language);
 const quote='/decrire-mon-besoin?selection='+p.product_id+'&supplier='+p.organization_id;
 // Candidate offers come from public sources: there is no company account to message, GSL handles the enquiry.
 const message=candidate?quote:'/messagerie?product='+p.product_id;
 const details=manufacturer?.public_details||{};
 const makerName=manufacturer?.display_name||l('Company profile','Fiche entreprise');
 const makerLocation=manufacturer?[manufacturer.city,countryName(manufacturer.country_code,language)].filter(Boolean).join(', '):'';
 const makerStatus=details.candidate?l('Documented by GSL from public sources','Documenté par GSL à partir de sources publiques'):details.verification==='unverified'?l('Unverified company','Entreprise non vérifiée'):manufacturer?.catalogue_status==='not_admitted'?l('Not admitted to the GSL catalogue','Non admis au catalogue GSL'):l('Profile reviewed by GSL','Dossier examiné par GSL');
 const moq=sheet.commercial.find(r=>r.key==='minimum_quantity');const minimum=moq?formatSpecRow(moq,language):spec.minimum_quantity?spec.minimum_quantity+(spec.unit?' '+spec.unit:''):'';const familyLabel=sheet.family?l(sheet.family.en,sheet.family.fr):categoryLabel(p.category);
 const made=spec.manufacturing_country?countryName(spec.manufacturing_country,language):'';
 const others=makerProducts.filter(x=>x.product_id!==p.product_id).slice(0,4);
 const commercial:[string,string][]=[[l('Minimum order','Quantité minimale'),minimum],[l('Sales unit','Unité de vente'),quantityUnitLabels[spec.unit||'']?l(quantityUnitLabels[spec.unit].en,quantityUnitLabels[spec.unit].fr):spec.unit||''],[l('Lead time','Délai'),spec.lead_time||''],[l('Manufacturing country','Pays de fabrication'),made],[l('Production site','Site de production'),spec.robotics_site||'']];
 const certified=spec.certification_documented==='true'&&!!spec.certifications;
 const missing=(value:string,text=l('To confirm','À confirmer'))=>value||<span className="is-missing">{text}</span>;
 const actions=<><Link className="ind-button" href={message}><MessageSquare size={17} aria-hidden/>{candidate?l('Contact GSL','Contacter GSL'):l('Contact the manufacturer','Contacter le fabricant')}</Link><Link className="ind-button-secondary" href={quote}><FileText size={17} aria-hidden/>{l('Request a quote','Demander un devis')}</Link></>;
 return <main className="container ind-sheet ind-product-sheet ps">
  <nav className="catalogue-breadcrumb"><Link href="/catalogue"><ArrowLeft size={16}/>{l('Catalogue','Catalogue')}</Link><span aria-hidden>/</span><Link href={'/catalogue?category='+encodeURIComponent(p.category)}>{categoryLabel(p.category)}</Link></nav>
  <div className="ind-sheet-layout ps-layout"><div className="ind-sheet-main">
   <div className="ps-intro">
    <Gallery images={[...supplierPhotos,...images]} name={p.name} category={sheet.familyId||p.category}/>
    <div className="ps-summary">
     <p className="ind-card-family"><CategoryIcon category={sheet.familyId||p.category} size={16}/>{familyLabel}</p>
     <h1 dir="auto">{p.name}</h1>
     {spec.reference&&<p className="ps-reference">{l('Manufacturer reference','Référence fabricant')} <span dir="auto">{spec.reference}</span></p>}
     <p className="ind-meta"><Link href={'/fabricants/'+p.organization_id}><Factory size={15} aria-hidden/>{makerName}</Link>{made&&<span><CountryFlag code={spec.manufacturing_country}/>{made}</span>}</p>
     <div className="ps-badges">
      {!admitted&&<span className="catalogue-status">{l('Not admitted to the GSL catalogue','Non admis au catalogue GSL')}</span>}
      {spec.verification==='unverified'&&<span className="catalogue-status">{l('Unverified product','Produit non vérifié')}</span>}
      {spec.qualification&&<span className={'source-badge'+(spec.qualification==='potential'?' source-badge-potential':'')}>{spec.qualification==='explicit'?l('Explicit robotics offer','Offre robotique explicite'):l('Component to qualify','Composant à qualifier')}</span>}
     </div>
     {!admitted?<p className="robotics-scope" role="note">{l('Published by its manufacturer and reachable by direct link. GSL has not reviewed this product and it does not appear in the catalogue.','Publié par son fabricant et accessible par lien direct. GSL n’a pas examiné ce produit et il n’apparaît pas dans le catalogue.')}</p>:!robotics&&<p className="robotics-scope" role="note">{l('This historical industrial profile has not been admitted to the robotics shortlist. Its suitability for robotics needs evidence.','Cette fiche industrielle historique n’est pas admise à la présélection robotique. Son adéquation à la robotique doit être étayée.')}</p>}
     <dl className="ps-facts">
      <div><dt>{l('Minimum order','Quantité minimale')}</dt><dd>{missing(minimum,l('Not disclosed','Non communiquée'))}</dd></div>
      <div><dt>{l('Lead time','Délai')}</dt><dd>{missing(spec.lead_time||'',l('Not disclosed','Non communiqué'))}</dd></div>
      <div><dt>{l('Made in','Fabrication')}</dt><dd>{made?<><CountryFlag code={spec.manufacturing_country}/>{made}</>:missing('')}</dd></div>
      <div><dt>{l('Price','Prix')}</dt><dd>{missing('',l('On quotation','Sur devis'))}</dd></div>
     </dl>
     <div className="ps-mobile-actions">{actions}</div>
    </div>
   </div>
   {description&&<section className="ind-section" id="description"><h2>{l('Description','Description')}</h2><p className="ind-copy ps-description" dir="auto">{description}</p>{spec.robotics_offer&&spec.robotics_offer!==description&&<p className="ind-copy" dir="auto">{spec.robotics_offer}</p>}</section>}
   <section className="ind-section" id="specifications"><h2>{l('Technical specifications','Caractéristiques techniques')}</h2>{rows.length?<dl className="ind-datasheet">{rows.map(row=><div key={row.key}><dt>{row.label}</dt><dd dir="auto">{row.value}</dd></div>)}</dl>:<p className="ind-empty">{l('No technical specification published. Ask the manufacturer for its datasheet.','Aucune caractéristique technique publiée. Demandez la fiche technique au fabricant.')}</p>}<p className="ind-footnote">{l('Values as published by the manufacturer. Confirm the exact configuration, interfaces and operating conditions before selecting.','Valeurs publiées par le fabricant. Confirmez la configuration exacte, les interfaces et les conditions d’usage avant de retenir l’offre.')}</p></section>
   <section className="ind-section" id="conditions"><h2>{l('Commercial terms','Conditions commerciales')}</h2><dl className="ind-datasheet">{commercial.map(([label,value])=><div key={label}><dt>{label}</dt><dd dir="auto">{missing(value)}</dd></div>)}</dl></section>
   <section className="ind-section" id="documents"><h2>{l('Compliance and documents','Conformité et documents')}</h2>
    <dl className="ind-datasheet">
     <div><dt>{l('Regulatory compliance','Conformité réglementaire')}</dt><dd>{spec.compliance==='not_assessed'?l('Not assessed by GSL','Non évaluée par GSL'):l('Not established by this listing','Non établie par cette fiche')}</dd></div>
     <div><dt>{l('Certifications','Certifications')}</dt><dd dir="auto">{certified?spec.certifications+' · '+l('document reviewed, currently valid','document examiné, en cours de validité'):<span className="is-missing">{l('None documented','Aucune documentée')}</span>}</dd></div>
     <div><dt>{l('Published documents','Documents publiés')}</dt><dd>{sources.length?sources.length+' '+(sources.length>1?l('public sources','sources publiques'):l('public source','source publique')):<span className="is-missing">{l('No document published with this listing','Aucun document publié avec cette fiche')}</span>}</dd></div>
     {spec.points_to_confirm&&<div><dt>{l('Points to confirm','Points à confirmer')}</dt><dd dir="auto">{spec.points_to_confirm}</dd></div>}
    </dl>
    {sources.length>0&&<ul className="ind-sources">{sources.map(x=><li key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer"><FileText size={15} aria-hidden/>{x.title}<ArrowUpRight size={14} aria-hidden/></a></li>)}</ul>}
    {robotics&&<dl className="ind-evidence"><div><dt>{l('Documented by GSL','Documenté par GSL')}</dt><dd>{l('Published sources establish the offer and production location. No factory inspection is implied.','Les sources publiées étayent l’offre et le lieu de production. Aucune inspection d’usine n’est présumée.')}</dd></div><div><dt>{l('Manufacturer declarations','Déclarations du fabricant')}</dt><dd>{l('Specifications and performance remain attributed to their sources. Confirm the exact configuration.','Les caractéristiques et performances restent attribuées à leurs sources. Confirmez la configuration exacte.')}</dd></div><div><dt>{l('Supporting documents: review to confirm','Justificatifs : revue à confirmer')}</dt><dd>{l('A document review must identify the reference, issuer, validity and scope. No product compliance is asserted by admission.','Une revue de justificatif doit préciser la référence, l’émetteur, la validité et le périmètre. L’admission n’atteste pas la conformité produit.')}</dd></div></dl>}
    <p className="ind-footnote">{l('Confirm quantity, tolerances, finish, delivery terms and technical evidence with the supplier. Publication does not establish regulatory conformity.','Confirmez les quantités, tolérances, finitions, conditions de livraison et justificatifs techniques avec le fournisseur. La publication ne prouve pas la conformité réglementaire.')} <Link href={quote}>{l('Ask for supporting documents','Demander les justificatifs')}</Link></p>
   </section>
  </div>
  <aside className="ind-sheet-aside">
   <section className="ind-panel ps-contact" id="contact"><h2>{candidate?l('Contact GSL','Contacter GSL'):l('Contact the manufacturer','Contacter le fabricant')}</h2><p>{candidate?l('This manufacturer is documented from public sources. GSL handles your enquiry and the quote with delivery.','Ce fabricant est documenté à partir de sources publiques. GSL traite votre demande et le devis avec livraison.'):l('Ask a question through GSL messaging, or request a priced quote including delivery.','Posez votre question par la messagerie GSL ou demandez un devis chiffré, livraison comprise.')}</p>{actions}<div className="ind-panel-tools"><SaveProduct id={p.product_id}/><CompareProduct id={p.product_id}/></div><p className="ps-price">{l('Price not disclosed','Prix non communiqué')}. {l('Specify your requirements to request a priced offer.','Précisez votre besoin pour demander une offre chiffrée.')}</p></section>
   <section className="ind-panel ps-maker"><p className="ps-maker-kicker">{l('Manufacturer','Fabricant')}</p><div className="ps-maker-head">{manufacturer?<CompanyMark supplier={manufacturer}/>:<Factory size={22} aria-hidden/>}<div><strong dir="auto">{makerName}</strong>{makerLocation&&<span><CountryFlag code={manufacturer!.country_code}/>{makerLocation}</span>}</div></div><p className="ps-maker-status">{makerStatus}</p>{spec.robotics_site&&<p className="ps-maker-site"><MapPin size={14} aria-hidden/>{spec.robotics_site}</p>}<Link className="ps-maker-link" href={'/fabricants/'+p.organization_id}>{l('View the manufacturer profile','Voir la fiche du fabricant')}<ArrowRight size={15} aria-hidden/></Link></section>
  </aside></div>
  {others.length>0&&<section className="ind-related"><div className="catalogue-section-heading"><h2>{l('Other products from this manufacturer','Autres produits de ce fabricant')}</h2><Link href={'/fabricants/'+p.organization_id+'#products'}>{l('All its offers','Toutes ses offres')}<ArrowRight size={17}/></Link></div><div className="catalogue-grid">{others.map(x=><ProductCard key={x.product_id} product={x}/>)}</div></section>}
  {similar.length>0&&<section className="ind-related"><div className="catalogue-section-heading"><h2>{l('Similar components','Composants similaires')}</h2><Link href={'/catalogue?category='+encodeURIComponent(p.category)}>{l('All products','Tous les produits')}<ArrowRight size={17}/></Link></div><div className="catalogue-grid">{similar.map(x=><ProductCard key={x.product_id} product={x}/>)}</div></section>}
 </main>;
}
