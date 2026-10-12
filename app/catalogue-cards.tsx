'use client';
import {trackJourney} from '@/lib/journey-analytics';
import {useState} from 'react';
import Image from 'next/image';
import {ArrowRight, ArrowUpRight, Armchair, BookOpen, Boxes, Building2, Cable, CircleDot, Cog, Cpu, Droplets, Factory, Flame, Hammer, Layers, Package, ScanLine, Shirt, SlidersHorizontal, Truck, Workflow, Wrench, Zap, type LucideIcon} from 'lucide-react';
import Link from '@/components/site-link';
import CountryFlag from '@/components/country-flag';
import {countryName} from '@/lib/country-names';
import {companyResearch, productResearch, researchCategories, type CompanyResearch} from '@/lib/catalogue-research';
import {categoryGroup, gslContactHref, publishedPrice, researchValue} from '@/lib/catalogue-display';
import {useLanguage} from './language';
import {roboticsFamilies,technicalRows} from '@/lib/robotics';
import {SaveProduct} from './saved-selection';
import {CompareProduct} from './compare-product';

export type CardProduct = {product_id: string; organization_id?: string; name: string; category: string; description?: string; specifications: Record<string, string>};
export type CardSupplier = {organization_id: string; display_name: string; country_code: string; city?: string; description?: string; public_details?: {verification?: string; branding?: {logoId?: string; coverIds?: string[]}; research?: CompanyResearch}};

export function useCategoryLabel() {
  const {l} = useLanguage();
  const labels: Record<string, string> = {metal: l('Metal & machining', 'Métal et usinage'), electricite: l('Electrical', 'Électricité'), emballage: l('Packaging', 'Emballage'), textile: l('Textiles', 'Textile'), plasturgie: l('Plastics', 'Plasturgie'), machines: l('Machinery', 'Machines'), construction: l('Construction', 'Construction'), mobilier: l('Furniture', 'Mobilier')};
  for (const category of [...researchCategories,...roboticsFamilies]) labels[category.id] = l(category.en, category.fr);
  return (category: string) => labels[category] || category || l('Manufacturing capabilities', 'Capacités de fabrication');
}

const categoryIcons: Record<string, LucideIcon> = {
  'robots-plateformes': Factory, 'actionnement-transmission': Cog, prehension: Wrench, 'capteurs-vision': ScanLine, 'commande-electronique': Cpu, 'mecanique-cablage': Cable,
  metal: Cog, electricite: Zap, emballage: Package, textile: Shirt, plasturgie: Boxes, machines: Factory, construction: Building2, mobilier: Armchair,
  'usinage-precision': ScanLine, 'tolerie-soudage': Hammer, 'fonderie-forge': Flame, 'aluminium-extrusion': Layers,
  'roulements-transmission': Cog, 'pompes-hydraulique': Droplets, 'ressorts-fixations': Wrench, 'moules-injection': Boxes,
  'cables-electriques': Cable, 'faisceaux-cablage': Workflow, 'electronique-capteurs': Cpu, 'energie-transformateurs': Zap,
  'automatismes-appareillage': SlidersHorizontal, 'acier-construction': Building2, 'elastomeres-etancheite': CircleDot,
  'manutention-industrielle': Truck,
};

export function CategoryIcon({category, size = 22, strokeWidth = 1.5}: {category: string; size?: number; strokeWidth?: number}) {
  const Icon = categoryIcons[category] || Package;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden/>;
}

export function ResearchLabel() {
  const {l} = useLanguage();
  return <span className="catalogue-research-label"><BookOpen size={13} aria-hidden/>{l('Documented by GSL', 'Fiche documentée par GSL')}</span>;
}

export function ProductVisual({product}: {product: CardProduct}) {
  const categoryLabel = useCategoryLabel();
  const {l} = useLanguage();
  return <div className={'catalogue-product-visual visual-' + categoryGroup(product.category).replace(/[^a-z]/g, '')}>
    <span className="catalogue-category">{categoryLabel(product.category)}</span>
    <div className="catalogue-visual-symbol" aria-hidden><CategoryIcon category={product.category} size={68} strokeWidth={1}/></div>
    <span className="catalogue-visual-caption">{l('Product sheet', 'Fiche produit')}<ArrowUpRight size={16} aria-hidden/></span>
  </div>;
}

export function CompanyMark({supplier}: {supplier: CardSupplier}) {
  const [failed, setFailed] = useState(false);
  return supplier.public_details?.branding?.logoId && !failed
    ? <Image unoptimized width={64} height={64} className="catalogue-company-logo" src={'/api/company-images?id=' + encodeURIComponent(supplier.public_details.branding.logoId)} alt="" onError={() => setFailed(true)}/>
    : <span className="catalogue-company-monogram" aria-hidden>{supplier.display_name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || <Factory size={26}/>}</span>;
}

export function ProductCard({product: p, supplier}: {product: CardProduct; supplier?: CardSupplier}) {
  const {l, language} = useLanguage();
  const research = productResearch(p.specifications);
  const country = p.specifications.manufacturing_country;
  const price = research ? publishedPrice(research.commercial, language) : null;
  const minimum = research ? researchValue(research.commercial.moq) : p.specifications.minimum_quantity;
  const material = research ? research.materials.filter(Boolean).join(', ') : p.specifications.materials;
  const process = p.specifications.processes || (research ? Object.entries(research.specifications).find(([key]) => /proc[eé]d[eé]|process|fabrication/i.test(key))?.[1] : null);
  return <article className="catalogue-product-card">
    <div className="catalogue-card-media"><Link onClick={()=>trackJourney('product_opened',{family:p.category})} href={'/produits/' + p.product_id} aria-label={p.name}><ProductVisual product={p}/></Link><SaveProduct id={p.product_id} compact/></div>
    <div className="catalogue-card-body">
      {supplier && <Link className="catalogue-byline" href={'/fabricants/' + supplier.organization_id}><Factory size={14} aria-hidden/>{supplier.display_name}</Link>}
      <h3><Link onClick={()=>trackJourney('product_opened',{family:p.category})} href={'/produits/' + p.product_id}>{p.name}</Link></h3>
      {research && <ResearchLabel/>}
      {p.description && <p className="catalogue-card-description">{p.description}</p>}
      <dl className="catalogue-card-facts">
        {technicalRows(p.category,p.specifications).slice(0,2).map(m=><div key={m.key}><dt>{l(m.en,m.fr)}</dt><dd>{m.value} {m.unit}</dd></div>)}
        <div><dt>{l('Material', 'Matière')}</dt><dd>{material || l('Not disclosed', 'Non communiqué')}</dd></div>
        {(!research || Boolean(process)) && <div><dt>{l('Process', 'Procédé')}</dt><dd>{process || l('Not disclosed', 'Non communiqué')}</dd></div>}
      </dl>
      <div className="catalogue-card-meta"><span>{country ? <><CountryFlag code={country}/>{countryName(country, language)}</> : l('Manufacturing country to confirm', 'Pays de fabrication à confirmer')}</span><span>{minimum ? `${l('Min.', 'Min.')} ${minimum}${!research && p.specifications.unit ? ' ' + p.specifications.unit : ''}` : l('MOQ not disclosed', 'MOQ non communiqué')}</span></div>
      {research && <div className="catalogue-card-research-meta"><span>{price || l('Price not disclosed', 'Prix non communiqué')}</span><span><BookOpen size={12} aria-hidden/>{research.sources.length} {l('sources', 'sources')}</span></div>}
      {research && researchValue(research.commercial.availability) && <p className="catalogue-card-availability">{researchValue(research.commercial.availability)}</p>}
      {!research && p.specifications.verification === 'unverified' && <span className="catalogue-status">{l('Unverified product', 'Produit non vérifié')}</span>}
      <div className="catalogue-card-action"><CompareProduct id={p.product_id}/><Link onClick={()=>trackJourney('product_opened',{family:p.category})} href={'/produits/' + p.product_id}>{l('View product', 'Voir le produit')}<ArrowRight size={17} aria-hidden/></Link></div>
    </div>
  </article>;
}

export function SupplierCard({supplier: s, products = []}: {supplier: CardSupplier; products?: CardProduct[]}) {
  const {l, language} = useLanguage();
  const categoryLabel = useCategoryLabel();
  const research = companyResearch(s.public_details);
  const categories = [...new Set([...(research?.categories || []), ...products.map(p => p.category)].filter(Boolean))];
  return <article className="catalogue-supplier-card">
    <div className="catalogue-company-heading"><CompanyMark supplier={s}/><div><p className="catalogue-byline">{l('Industrial company', 'Entreprise industrielle')}</p><h3><Link href={'/fabricants/' + s.organization_id}>{s.display_name}</Link></h3><p className="catalogue-location"><CountryFlag code={s.country_code}/>{[s.city, countryName(s.country_code, language)].filter(Boolean).join(' · ')}</p></div></div>
    {research && <ResearchLabel/>}
    <p className="catalogue-card-description">{s.description}</p>
    {categories.length > 0 && <div className="catalogue-tags">{categories.slice(0, 4).map(category => <span key={category}><CategoryIcon category={category} size={13}/>{categoryLabel(category)}</span>)}</div>}
    {products.length > 0 && <div className="catalogue-company-products"><span>{l('Products & capabilities', 'Produits et capacités')}</span>{products.slice(0, 3).map(p => <Link key={p.product_id} href={'/produits/' + p.product_id}><Package size={16} aria-hidden/>{p.name}<ArrowUpRight size={14} aria-hidden/></Link>)}</div>}
    {research && <p className="catalogue-card-evidence"><BookOpen size={14} aria-hidden/>{l('Activities, documents and trade framework sourced by GSL.', 'Activités, documents et cadre commercial sourcés par GSL.')}</p>}
    {!research && s.public_details?.verification === 'unverified' && <span className="catalogue-status">{l('Unverified company', 'Entreprise non vérifiée')}</span>}
    <div className="catalogue-company-actions"><Link className="catalogue-primary" href={'/fabricants/' + s.organization_id}>{l('View manufacturer', 'Voir le fabricant')}<ArrowRight size={16} aria-hidden/></Link><Link className="catalogue-secondary" href={gslContactHref(s.organization_id)}>{research ? l('Contact GSL', 'Contacter GSL') : l('Contact', 'Contacter')}</Link></div>
  </article>;
}
