'use client';
import {useEffect,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import {CategoryIcon,CompanyMark,useCategoryLabel} from './catalogue-cards';
import CountryFlag from '@/components/country-flag';
import FactoryMark,{factoryCountries} from '@/components/factory-mark';
import {countryName} from '@/lib/country-names';
import {productResearch} from '@/lib/catalogue-research';
import {publishedPrice} from '@/lib/catalogue-display';
import {referencedMakerHref,referencedMakers,referencedProductHref,type ReferencedMaker as ReferencedMakerRow} from '@/lib/referenced-makers';
import ProductPicture from './product-image';
type Manufacturer={organization_id:string;display_name:string;country_code:string};
type Product={product_id:string;name:string;category:string;description:string;specifications:Record<string,string>;manufacturer:Manufacturer};
type Supplier=Manufacturer&{city:string;description:string;public_details?:{verification?:string;branding?:{logoId?:string}}};
type Feed={products:Product[];suppliers:Supplier[];families:Record<string,number>};
/** Compact square tiles: picture, title and the one fact a buyer scans first. */
function MiniProduct({product:p}:{product:Product}){
 const {l,language}=useLanguage();const categoryLabel=useCategoryLabel();
 const research=productResearch(p.specifications);
 const price=research?publishedPrice(research.commercial,language):null;
 const country=p.specifications.manufacturing_country||p.manufacturer.country_code;
 return <li className="home-mini"><Link href={'/produits/'+p.product_id}>
  <span className="home-mini-visual" aria-hidden><CategoryIcon category={p.category} size={40} strokeWidth={1.2}/></span>
  <span className="home-mini-family">{categoryLabel(p.category)}</span>
  <strong>{p.name}</strong>
  <span className="home-mini-price">{price||l('Price on request','Prix sur devis')}</span>
  <span className="home-mini-meta"><CountryFlag code={country}/>{countryName(country,language)}</span>
 </Link></li>;
}
function MiniMaker({supplier:s}:{supplier:Supplier}){
 const {language}=useLanguage();
 return <li className="home-mini home-mini-maker"><Link href={'/fabricants/'+s.organization_id}>
  <span className="home-mini-visual"><CompanyMark supplier={s}/></span>
  <strong>{s.display_name}</strong>
  <span className="home-mini-meta"><CountryFlag code={s.country_code}/>{[s.city,countryName(s.country_code,language)].filter(Boolean).join(' · ')}</span>
 </Link></li>;
}
function useFamilyLabel(){
 const {l}=useLanguage();const categoryLabel=useCategoryLabel();
 return (family:string)=>family==='robots-plateformes'?l('Robots and platforms','Robots et plateformes'):categoryLabel(family);
}
function ReferencedProduct({maker:m}:{maker:ReferencedMakerRow}){
 const {language}=useLanguage();const categoryLabel=useFamilyLabel();
 return <li className="home-mini"><Link href={referencedProductHref(m)}>
  {m.image?<ProductPicture image={m.image} alt={language==='fr'?m.productFr:m.productEn} className="home-mini-visual" linkCredit={false}/>:<span className="home-mini-visual" aria-hidden><CategoryIcon category={m.family} size={40} strokeWidth={1.2}/></span>}
  <span className="home-mini-family">{categoryLabel(m.family)}</span>
  <strong dir="auto">{language==='fr'?m.productFr:m.productEn}</strong>
  <span className="home-mini-meta">{m.company} · {countryName(m.country,language)}</span>
 </Link></li>;
}
function ReferencedMaker({maker:m}:{maker:ReferencedMakerRow}){
 const {language}=useLanguage();const categoryLabel=useFamilyLabel();
 return <li className="home-mini home-mini-maker"><Link href={referencedMakerHref(m)}>
  <span className="home-mini-visual"><span className="catalogue-company-monogram is-factory" aria-hidden><FactoryMark countries={factoryCountries(m.country)}/></span></span>
  <strong>{m.company}</strong>
  <span className="home-mini-family">{categoryLabel(m.family)}</span>
  <span className="home-mini-meta">{m.city} · {countryName(m.country,language)}</span>
 </Link></li>;
}
export default function HomeCatalogue(){
 const {l}=useLanguage();const [feed,setFeed]=useState<Feed|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch('/api/home-catalogue',{signal:controller.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<Feed>}).then(d=>{setFeed(d);setError(false)}).catch(e=>{if(e.name!=='AbortError')setError(true)});return()=>controller.abort()},[]);
 const loading=<div className="home-listing-loading" role="status">{l('Loading the catalogue…','Chargement du catalogue…')}</div>;
 // Until manufacturers publish on GSL (or if the catalogue is unreachable), show the makers GSL identified from public sources, clearly labelled.
 const published=feed&&!error;
 const showReferencedProducts=error||(feed&&!feed.products.length);
 const showReferencedMakers=error||(feed&&!feed.suppliers.length);
 const referencedNote=<p className="home-referenced-note">{l('Identified from public sources. Not registered on GSL and not verified.','Repérés dans des sources publiques. Non inscrits sur GSL et non vérifiés.')}</p>;
 return <><section className="container gsl-section home-listings" id="products"><div className="gsl-section-head"><div><h2>{l('Latest documented offers','Dernières offres documentées')}</h2><p>{l('Robotics offers with dated sources and an identified production site.','Offres robotiques avec sources datées et site de production identifié.')}</p></div><Link href="/catalogue">{l('All components','Tous les composants')}<ArrowRight size={18}/></Link></div>
  {!feed&&!error?loading:showReferencedProducts?<>{referencedNote}<ul className="home-mini-grid">{referencedMakers.map(m=><ReferencedProduct key={m.id} maker={m}/>)}</ul></>:published&&<ul className="home-mini-grid">{feed.products.map(p=><MiniProduct key={p.product_id} product={p}/>)}</ul>}</section>
 <section className="home-manufacturers"><div className="container gsl-section home-listings" id="suppliers"><div className="gsl-section-head"><div><h2>{l('Manufacturers','Les fabricants')}</h2><p>{l('The companies behind the components, with their production sites.','Les entreprises derrière les composants, avec leurs sites de production.')}</p></div><Link href="/fabricants">{l('All manufacturers','Tous les fabricants')}<ArrowRight size={18}/></Link></div>
  {!feed&&!error?loading:showReferencedMakers?<>{referencedNote}<ul className="home-mini-grid">{referencedMakers.map(m=><ReferencedMaker key={m.id} maker={m}/>)}</ul></>:published&&<ul className="home-mini-grid">{feed.suppliers.map(s=><MiniMaker key={s.organization_id} supplier={s}/>)}</ul>}</div></section></>;
}
