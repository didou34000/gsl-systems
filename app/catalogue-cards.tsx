'use client';
import {productPhotoIds} from '@/lib/products/review';
import {trackJourney} from '@/lib/journey-analytics';
import {useState} from 'react';
import Image from 'next/image';
import {ArrowRight, ArrowUpRight, Armchair, BatteryCharging, BookOpen, Bot, Boxes, Building2, Cable, CircleDot, Cog, Cpu, Grab, Droplets, Nut, Settings2, Factory, Flame, Hammer, Layers, Package, ScanLine, Shirt, SlidersHorizontal, Truck, Workflow, Wrench, Zap, type LucideIcon} from 'lucide-react';
import Link from '@/components/site-link';
import CountryFlag from '@/components/country-flag';
import FactoryMark, {factoryCountries} from '@/components/factory-mark';
import {countryName} from '@/lib/country-names';
import {companyResearch, productResearch, researchCategories, type CompanyResearch} from '@/lib/catalogue-research';
import {categoryGroup, gslContactHref, publishedPrice, researchValue} from '@/lib/catalogue-display';
import {useLanguage} from './language';
import {roboticsFamilies,technicalRows} from '@/lib/robotics';
import {SaveProduct} from './saved-selection';
import {CompareProduct} from './compare-product';

export type CardProduct = {product_id: string; organization_id?: string; name: string; category: string; description?: string; specifications: Record<string, string>};
export type CardSupplier = {organization_id: string; display_name: string; country_code: string; city?: string; description?: string; public_details?: {qualification?:string;delivery_status?:string;verification?: string; branding?: {logoId?: string; coverIds?: string[]}; sites?: {country?: string}[]; research?: CompanyResearch}};

export function useCategoryLabel() {
  const {l} = useLanguage();
  const labels: Record<string, string> = {metal: l('Metal & machining', 'Métal et usinage'), electricite: l('Electrical', 'Électricité'), emballage: l('Packaging', 'Emballage'), textile: l('Textiles', 'Textile'), plasturgie: l('Plastics', 'Plasturgie'), machines: l('Machinery', 'Machines'), construction: l('Construction', 'Construction'), mobilier: l('Furniture', 'Mobilier')};
  for (const category of [...researchCategories,...roboticsFamilies]) labels[category.id] = l(category.en, category.fr);
  return (category: string) => labels[category] || category || l('Manufacturing capabilities', 'Capacités de fabrication');
}

const categoryIcons: Record<string, LucideIcon> = {
  'robots-plateformes': Bot, 'actionnement-transmission': Zap, 'transmissions-guidages': Settings2, 'cables-connecteurs': Cable, 'energie-batteries': BatteryCharging, 'pieces-mecaniques': Nut, prehension: Grab, 'capteurs-vision': ScanLine, 'commande-electronique': Cpu, 'mecanique-cablage': Cable,
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
  const photo=productPhotoIds(product.specifications?.photo_ids)[0];
  const categoryLabel = useCategoryLabel();
  const {l} = useLanguage();
  return <div className={'catalogue-product-visual visual-' + categoryGroup(product.category).replace(/[^a-z]/g, '')}>
    <span className="catalogue-category">{categoryLabel(product.category)}</span>
    {photo?<Image className="catalogue-supplier-photo" unoptimized width={640} height={480} src={'/api/product-images?id='+photo} alt={product.name}/>:<div className="catalogue-visual-symbol" aria-hidden><CategoryIcon category={product.category} size={68} strokeWidth={1}/></div>}
    <span className="catalogue-visual-caption">{l('Product sheet', 'Fiche produit')}<ArrowUpRight size={16} aria-hidden/></span>
  </div>;
}

export function CompanyMark({supplier}: {supplier: CardSupplier}) {
  const [failed, setFailed] = useState(false);
  return supplier.public_details?.branding?.logoId && !failed
    ? <Image unoptimized width={64} height={64} className="catalogue-company-logo" src={'/api/company-images?id=' + encodeURIComponent(supplier.public_details.branding.logoId)} alt="" onError={() => setFailed(true)}/>
    : <span className="catalogue-company-monogram is-factory" aria-hidden><FactoryMark countries={factoryCountries(supplier.country_code, supplier.public_details?.sites)}/></span>;
}

/** Key figures shown on cards and sheets: robotics metrics first, then declared basics. */
export function keySpecs(p: CardProduct, l: (en: string, fr: string) => string, limit = 4) {
  const research = productResearch(p.specifications);
  const rows = technicalRows(p.category, p.specifications).map(m => ({key: m.key, label: l(m.en, m.fr), value: `${m.value} ${m.unit}`}));
  const material = research ? research.materials.filter(Boolean).join(', ') : p.specifications.materials;
  const process = p.specifications.processes || (research ? Object.entries(research.specifications).find(([key]) => /proc[eé]d[eé]|process|fabrication/i.test(key))?.[1] : null);
  if (rows.length < 2 && material) rows.push({key: 'material', label: l('Material', 'Matière'), value: material});
  if (rows.length < 2 && process) rows.push({key: 'process', label: l('Process', 'Procédé'), value: process});
  return rows.slice(0, limit);
}

export function ProductCard({product: p, supplier}: {product: CardProduct; supplier?: CardSupplier}) {
  const {l, language} = useLanguage();
  const categoryLabel = useCategoryLabel();
  const research = productResearch(p.specifications);
  const country = p.specifications.manufacturing_country;
  const price = research ? publishedPrice(research.commercial, language) : null;
  const minimum = research ? researchValue(research.commercial.moq) : p.specifications.minimum_quantity;
  const specs = keySpecs(p, l);
  const open = () => trackJourney('product_opened', {family: p.category});
  return <article className="ind-card">
    <div className="ind-card-top"><span className="ind-card-family"><CategoryIcon category={p.category} size={15}/>{categoryLabel(p.category)}</span><SaveProduct id={p.product_id} compact/></div>
    <h3><Link onClick={open} href={'/produits/' + p.product_id}>{p.name}</Link></h3>
    {supplier && <Link className="ind-card-maker" href={'/fabricants/' + supplier.organization_id}><Factory size={14} aria-hidden/>{supplier.display_name}</Link>}
    {research && <ResearchLabel/>}
    {p.specifications.qualification&&<span className={'source-badge'+(p.specifications.qualification==='potential'?' source-badge-potential':'')}>{p.specifications.qualification==='explicit'?l('Explicit robotics offer','Offre robotique explicite'):l('Component to qualify','Composant à qualifier')}</span>}

    {specs.length > 0 ? <dl className="ind-specs">{specs.map(s => <div key={s.key}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl> : p.description && <p className="ind-card-description">{p.description}</p>}
    <dl className="ind-card-facts">
      <div><dt>{l('Made in', 'Fabrication')}</dt><dd>{country ? <><CountryFlag code={country}/>{countryName(country, language)}</> : l('To confirm', 'À confirmer')}</dd></div>
      <div><dt>{l('Minimum order', 'Qté minimale')}</dt><dd>{minimum ? `${minimum}${!research && p.specifications.unit ? ' ' + p.specifications.unit : ''}` : l('Not disclosed', 'Non communiquée')}</dd></div>
      {research && <div><dt>{l('Price', 'Prix')}</dt><dd>{price || l('Not disclosed', 'Non communiqué')}</dd></div>}
    </dl>
    {!research && p.specifications.verification === 'unverified' && <span className="catalogue-status">{l('Unverified product', 'Produit non vérifié')}</span>}
    <div className="ind-card-actions"><CompareProduct id={p.product_id}/><Link onClick={open} href={'/produits/' + p.product_id}>{l('View datasheet', 'Voir la fiche')}<ArrowRight size={16} aria-hidden/></Link></div>
  </article>;
}

export function SupplierCard({supplier: s, products = []}: {supplier: CardSupplier; products?: CardProduct[]}) {
  const {l, language} = useLanguage();
  const categoryLabel = useCategoryLabel();
  const research = companyResearch(s.public_details);
  const categories = [...new Set([...(research?.categories || []), ...products.map(p => p.category)].filter(Boolean))];
  return <article className="ind-card ind-supplier-card">
    <div className="ind-company-head"><CompanyMark supplier={s}/><div><h3><Link href={'/fabricants/' + s.organization_id}>{s.display_name}</Link></h3><p className="ind-location"><CountryFlag code={s.country_code}/>{[s.city, countryName(s.country_code, language)].filter(Boolean).join(' · ')}</p></div></div>
    {research && <ResearchLabel/>}
    {s.public_details?.qualification&&<span className="source-badge">{s.public_details.qualification==='explicit'?l('Explicit robotics offer','Offre robotique explicite'):l('Components to qualify','Composants à qualifier')}</span>}
    {s.description && <p className="ind-card-description">{s.description}</p>}
    {categories.length > 0 && <ul className="ind-tags">{categories.slice(0, 4).map(category => <li key={category}><CategoryIcon category={category} size={13}/>{categoryLabel(category)}</li>)}</ul>}
    {products.length > 0 && <div className="ind-company-products"><p>{products.length} {products.length > 1 ? l('published offers', 'offres publiées') : l('published offer', 'offre publiée')}</p><ul>{products.slice(0, 3).map(p => <li key={p.product_id}><Link href={'/produits/' + p.product_id}>{p.name}<ArrowUpRight size={14} aria-hidden/></Link></li>)}</ul></div>}
    {!research && s.public_details?.verification === 'unverified' && <span className="catalogue-status">{l('Unverified company', 'Entreprise non vérifiée')}</span>}
    <div className="ind-card-actions"><Link className="ind-button" href={'/fabricants/' + s.organization_id}>{l('View manufacturer', 'Voir le fabricant')}<ArrowRight size={16} aria-hidden/></Link><Link className="ind-button-secondary" href={gslContactHref(s.organization_id)}>{research ? l('Contact GSL', 'Contacter GSL') : l('Contact', 'Contacter')}</Link></div>
  </article>;
}
