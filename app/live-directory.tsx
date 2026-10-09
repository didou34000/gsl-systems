'use client';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import {sectors} from '@/lib/catalog';
import {researchCategories} from '@/lib/catalogue-research';
import {ArrowRight} from 'lucide-react';
import {CategoryIcon,useCategoryLabel} from './catalogue-cards';
import SourcingNetwork from './sourcing-network';
export default function LiveDirectory({kind}:{kind:'sectors'|'countries'}) {
 const {l}=useLanguage();const categoryLabel=useCategoryLabel();
 if(kind==='countries')return <main><SourcingNetwork/></main>;
 return <main className="container catalogue-page catalogue-sector-page"><header className="catalogue-lead"><div><p className="eyebrow">{l('INDUSTRIAL KNOW-HOW','SAVOIR-FAIRE INDUSTRIEL')}</p><h1>{l('Manufacturing sectors','Secteurs de fabrication')}</h1><p>{l('Find a manufacturing speciality, explore documented product families and examine the sources behind each profile.','Choisissez une spécialité, explorez les familles de produits documentées et consultez les sources de chaque fiche.')}</p></div></header><section><div className="catalogue-section-heading"><h2>{l('Industrial specialities','Spécialités industrielles')}</h2><span>{researchCategories.length}</span></div><div className="catalogue-sector-grid">{researchCategories.map(category=><Link key={category.id} href={'/fabricants?category='+category.id} className={'catalogue-sector-tile sector-'+category.group}><span className="catalogue-sector-icon"><CategoryIcon category={category.id} size={32}/></span><h2>{categoryLabel(category.id)}</h2><span className="catalogue-sector-explore">{l('Explore manufacturers','Explorer les fabricants')}<ArrowRight size={16} aria-hidden/></span></Link>)}</div></section><section className="catalogue-broad-sectors"><div className="catalogue-section-heading"><h2>{l('Browse all broad sectors','Explorer tous les grands secteurs')}</h2></div><div className="catalogue-specialty-grid">{sectors.map(sector=><Link key={sector.id} href={'/fabricants?category='+sector.id}><CategoryIcon category={sector.id} size={22}/><span>{categoryLabel(sector.id)}</span><ArrowRight size={14} aria-hidden/></Link>)}</div></section></main>;
}
