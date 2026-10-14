'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,Factory,Package,Plus} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import {CategoryIcon,CompanyMark,useCategoryLabel} from './catalogue-cards';
import CountryFlag from '@/components/country-flag';
import {countryName} from '@/lib/country-names';
import {productResearch} from '@/lib/catalogue-research';
import {publishedPrice} from '@/lib/catalogue-display';
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
export default function HomeCatalogue(){
 const {l}=useLanguage();const [feed,setFeed]=useState<Feed|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();fetch('/api/home-catalogue',{signal:controller.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<Feed>}).then(d=>{setFeed(d);setError(false)}).catch(e=>{if(e.name!=='AbortError')setError(true)});return()=>controller.abort()},[attempt]);
 const pending=()=>error?<div className="home-listing-empty" role="alert"><p>{l('The catalogue could not be loaded.','Le catalogue n’a pas pu être chargé.')}</p><button onClick={()=>{setError(false);setAttempt(a=>a+1)}}>{l('Retry','Réessayer')}</button></div>:<div className="home-listing-loading" role="status">{l('Loading the catalogue…','Chargement du catalogue…')}</div>;
 return <><section className="container gsl-section home-listings" id="products"><div className="gsl-section-head"><div><h2>{l('Latest documented offers','Dernières offres documentées')}</h2><p>{l('Robotics offers with dated sources and an identified production site.','Offres robotiques avec sources datées et site de production identifié.')}</p></div><Link href="/catalogue">{l('All components','Tous les composants')}<ArrowRight size={18}/></Link></div>{!feed?pending():feed.products.length?<ul className="home-mini-grid">{feed.products.map(p=><MiniProduct key={p.product_id} product={p}/>)}</ul>:<div className="home-listing-empty"><Package size={32} strokeWidth={1.4}/><div><h3>{l('The product catalogue is taking shape','Le catalogue produits se prépare')}</h3><p>{l('Products will appear here as manufacturers publish them.','Les produits apparaîtront ici au fil de leur publication par les fabricants.')}</p></div><Link href="/mes-produits"><Plus size={16}/>{l('Add my products','Ajouter mes produits')}</Link></div>}</section>
 <section className="home-manufacturers"><div className="container gsl-section home-listings" id="suppliers"><div className="gsl-section-head"><div><h2>{l('Manufacturers','Les fabricants')}</h2><p>{l('The companies behind the components, with their production sites.','Les entreprises derrière les composants, avec leurs sites de production.')}</p></div><Link href="/fabricants">{l('All manufacturers','Tous les fabricants')}<ArrowRight size={18}/></Link></div>{!feed?pending():feed.suppliers.length?<ul className="home-mini-grid">{feed.suppliers.map(s=><MiniMaker key={s.organization_id} supplier={s}/>)}</ul>:<div className="home-listing-empty"><Factory size={32} strokeWidth={1.4}/><div><h3>{l('Present your company','Présentez votre entreprise')}</h3><p>{l('Published manufacturer profiles will appear in this directory.','Les fiches fabricants publiées apparaîtront dans cet annuaire.')}</p></div><Link href="/espace-fournisseur"><Plus size={16}/>{l('List my company','Référencer mon entreprise')}</Link></div>}</div></section></>;
}
