'use client';

import {gslContactHref} from '@/lib/catalogue-display';
import {ProductSheet} from './product-sheet';
import {ArrowLeft,ArrowRight,MessageSquare} from 'lucide-react';
import Link from '@/components/site-link';
import CountryFlag from '@/components/country-flag';
import FactoryMark,{factoryCountries} from '@/components/factory-mark';
import {countryName} from '@/lib/country-names';
import {type PublicProduct,type PublicSupplier} from './public-profiles';
import {useLanguage} from './language';
import {findReferencedMaker,findReferencedProduct,referencedMakerId,type ReferencedMaker} from '@/lib/referenced-makers';

// Entries identified from public sources have no GSL account: their pages reuse the public sheets with
// a candidate id, so contact goes through GSL, and every value stays attributed to the published sources.
function asProduct(m:ReferencedMaker,fr:boolean):PublicProduct{
 const specs=Object.fromEntries(m.specs.map(s=>[fr?s.fr:s.en,fr&&s.valueFr?s.valueFr:s.value]));
 return {product_id:m.id,organization_id:referencedMakerId(m),name:fr?m.productFr:m.productEn,description:fr?m.noteFr:m.noteEn,category:m.family,published_at:m.checkedAt,
  specifications:{...specs,reference:m.reference,candidate_id:m.id,robotics_family:m.family,verification:'unverified',manufacturing_country:m.country,robotics_site:m.city,robotics_sources:JSON.stringify(m.sources),robotics_checked_at:m.checkedAt}};
}
function asSupplier(products:ReferencedMaker[],fr:boolean):PublicSupplier{
 const m=products[0];
 return {organization_id:referencedMakerId(m),display_name:m.company,country_code:m.country,city:m.city,description:'',processes:[],materials:[],published_at:m.checkedAt,
  public_details:{candidate:true,sources:[...new Map(products.flatMap(p=>p.sources).map(s=>[s.url,s])).values()],site:m.city,checked_at:m.checkedAt,points_to_confirm:fr?'Fabricant non inscrit sur GSL et non vérifié. Les informations viennent de ses documents publiés.':'Manufacturer not registered on GSL and unverified. The information comes from its published documents.'}};
}

export function ReferencedProductPage({id}:{id:string}){
 const {language}=useLanguage();const fr=language==='fr';const m=findReferencedProduct(id);if(!m)return null;
 const siblings=findReferencedMaker(referencedMakerId(m))||[];
 return <ProductSheet product={asProduct(m,fr)} similar={[]} manufacturer={asSupplier(siblings,fr)} makerProducts={siblings.map(x=>asProduct(x,fr))} images={m.image?[m.image]:[]}/>;
}
export function ReferencedMakerPage({id}:{id:string}){
 const {l,language}=useLanguage();const fr=language==='fr';const products=findReferencedMaker(id);if(!products)return null;
 const m=products[0];const sources=[...new Map(products.flatMap(p=>p.sources).map(x=>[x.url,x])).values()];
 const checked=new Date(m.checkedAt).toLocaleDateString(language,{day:'numeric',month:'long',year:'numeric'});
 return <main className="container ind-sheet ref-maker">
  <nav className="catalogue-breadcrumb"><Link href="/fabricants"><ArrowLeft size={16}/>{l('Manufacturers','Fabricants')}</Link><span aria-hidden>/</span><span>{m.company}</span></nav>
  <div className="ind-sheet-layout"><div className="ind-sheet-main">
   <div className="ind-company-head ref-maker-head"><span className="catalogue-company-monogram is-factory" aria-hidden><FactoryMark countries={factoryCountries(m.country)}/></span><div><h1 dir="auto">{m.company}</h1>
   <p className="ind-meta"><span><CountryFlag code={m.country}/>{m.city}, {countryName(m.country,language)}</span></p></div></div>
   <p><span className="catalogue-status">{l('Not registered, unverified','Non inscrit, non vérifié')}</span></p>
   <p className="robotics-scope" role="note">{l('This manufacturer was identified by GSL from its published documents. It has no account on GSL, has not been contacted and has not been verified. Enquiries go through GSL.','Ce fabricant a été repéré par GSL dans ses documents publiés. Il n’a pas de compte sur GSL, n’a pas été contacté et n’a pas été vérifié. Les demandes passent par GSL.')}</p>
   <section className="ind-section"><h2>{l('Identified offers','Offres repérées')}</h2><dl className="ind-datasheet">{products.map(p=><div key={p.id}><dt><Link href={'/produits/'+p.id}>{fr?p.productFr:p.productEn}</Link></dt><dd dir="auto">{p.reference}</dd></div>)}</dl></section>
   <section className="ind-section"><h2>{l('Sources','Sources')}</h2><ul className="ind-sources">{sources.map(x=><li key={x.url}><span>{x.title}</span></li>)}</ul><p className="ind-footnote">{l('Checked on','Consulté le')} {checked}.</p></section>
  </div>
  <aside className="ind-sheet-aside"><section className="ind-panel ps-contact"><h2>{l('Contact GSL','Contacter GSL')}</h2><p>{l('GSL handles your enquiry with this manufacturer and the quote including delivery.','GSL traite votre demande auprès de ce fabricant et le devis avec livraison.')}</p><Link className="ind-button" href={gslContactHref(id)}><MessageSquare size={17} aria-hidden/>{l('Contact via GSL','Contacter via GSL')}<ArrowRight size={16} aria-hidden/></Link></section></aside></div>
 </main>;
}
