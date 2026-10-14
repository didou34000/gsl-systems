'use client';
import Link from '@/components/site-link';
import CountryFlag from '@/components/country-flag';
import {ArrowRight,ExternalLink} from 'lucide-react';
import {countryName} from '@/lib/country-names';
import {referencedMakers} from '@/lib/referenced-makers';
import {CategoryIcon,useCategoryLabel} from './catalogue-cards';
import {useLanguage} from './language';
import ProductPicture from './product-image';

/** Public-source references, kept apart from published network profiles: no contact, save or compare actions. */
export function ReferencedMakers({category='',country=''}:{category?:string;country?:string}){
 const {l,language}=useLanguage();const categoryLabel=useCategoryLabel();
 const rows=referencedMakers.filter(m=>(!category||m.family===category)&&(!country||m.country===country));
 if(!rows.length)return null;
 return <section className="referenced-makers" aria-labelledby="referenced-makers-title">
  <h2 id="referenced-makers-title">{l('Manufacturers identified from public sources','Fabricants repérés dans des sources publiques')}</h2>
  <p>{l('These manufacturers are not registered on GSL and have not been verified by GSL. The information comes from their published documents; enquiries go through GSL.','Ces fabricants ne sont pas inscrits sur GSL et n’ont pas été vérifiés par GSL. Les informations viennent de leurs documents publiés ; les demandes passent par GSL.')}</p>
  <div className="catalogue-grid product-grid-mode">{rows.map(m=><article className="ind-card" key={m.id}>
   {m.image&&<ProductPicture image={m.image} alt={language==='fr'?m.productFr:m.productEn}/>}
   <p className="ind-card-family"><CategoryIcon category={m.family} size={16}/>{categoryLabel(m.family)}</p>
   <h3 dir="auto">{language==='fr'?m.productFr:m.productEn}</h3>
   <p className="ind-card-maker"><CountryFlag code={m.country}/>{m.company}, {m.city}, {countryName(m.country,language)}</p>
   <span className="catalogue-status">{l('Not registered, unverified','Non inscrit, non vérifié')}</span>
   {m.specs.length>0?<dl className="ind-specs">{m.specs.map(s=><div key={s.fr}><dt>{language==='fr'?s.fr:s.en}</dt><dd>{language==='fr'&&s.valueFr?s.valueFr:s.value}</dd></div>)}</dl>:<p className="ind-card-description">{l('No specifications published by the manufacturer.','Aucune caractéristique publiée par le fabricant.')}</p>}
   <p className="ind-card-description">{language==='fr'?m.noteFr:m.noteEn}</p>
   <ul className="referenced-sources">{m.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<ExternalLink size={13} aria-hidden/></a></li>)}</ul>
   <div className="ind-card-actions"><span>{l('Checked on','Consulté le')} {new Date(m.checkedAt).toLocaleDateString(language,{day:'numeric',month:'short',year:'numeric'})}</span><Link href="/decrire-mon-besoin">{l('Ask GSL','Demander à GSL')}<ArrowRight size={16}/></Link></div>
  </article>)}</div>
 </section>;
}
