'use client';
import {useState} from 'react';
import Image from 'next/image';
import {ArrowRight,ArrowUpRight,Armchair,Boxes,Building2,Cog,Factory,Package,Shirt,Zap} from 'lucide-react';
import Link from '@/components/site-link';
import CountryFlag from '@/components/country-flag';
import {countryName} from '@/lib/country-names';
import {useLanguage} from './language';
import {SaveProduct} from './saved-selection';
import {CompareProduct} from './compare-product';

export type CardProduct={product_id:string;organization_id?:string;name:string;category:string;description?:string;specifications:Record<string,string>};
export type CardSupplier={organization_id:string;display_name:string;country_code:string;city?:string;description?:string;public_details?:{verification?:string;branding?:{logoId?:string;coverIds?:string[]}}};
export function useCategoryLabel(){const {l}=useLanguage();const labels:Record<string,string>={metal:l('Metal & machining','Métal et usinage'),electricite:l('Electrical','Électricité'),emballage:l('Packaging','Emballage'),textile:l('Textiles','Textile'),plasturgie:l('Plastics','Plasturgie'),machines:l('Machinery','Machines'),construction:l('Construction','Construction'),mobilier:l('Furniture','Mobilier')};return (category:string)=>labels[category]||category||l('Manufacturing capabilities','Capacités de fabrication');}
export function ProductVisual({product}:{product:CardProduct}){
 const categoryLabel=useCategoryLabel();const {l}=useLanguage();
 const icons:Record<string,typeof Package>={metal:Cog,electricite:Zap,emballage:Package,textile:Shirt,plasturgie:Boxes,machines:Factory,construction:Building2,mobilier:Armchair};const Icon=icons[product.category]||Package;
 return <div className={'catalogue-product-visual visual-'+product.category.replace(/[^a-z]/g,'')}><span className="catalogue-category">{categoryLabel(product.category)}</span><div className="catalogue-visual-symbol" aria-hidden><Icon size={68} strokeWidth={1}/></div><span className="catalogue-visual-caption">{l('Product sheet','Fiche produit')}<ArrowUpRight size={16} aria-hidden/></span></div>;
}
export function CompanyMark({supplier}:{supplier:CardSupplier}){const [failed,setFailed]=useState(false);return supplier.public_details?.branding?.logoId&&!failed?<Image unoptimized width={64} height={64} className="catalogue-company-logo" src={'/api/company-images?id='+encodeURIComponent(supplier.public_details.branding.logoId)} alt="" onError={()=>setFailed(true)}/>:<span className="catalogue-company-monogram" aria-hidden>{supplier.display_name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()||<Factory size={26}/>}</span>;}
export function ProductCard({product:p,supplier}:{product:CardProduct;supplier?:CardSupplier}){const {l,language}=useLanguage();const country=p.specifications.manufacturing_country;return <article className="catalogue-product-card">
 <div className="catalogue-card-media"><Link href={'/produits/'+p.product_id} aria-label={p.name}><ProductVisual product={p}/></Link><SaveProduct id={p.product_id} compact/></div>
 <div className="catalogue-card-body">{supplier&&<Link className="catalogue-byline" href={'/fabricants/'+supplier.organization_id}><Factory size={14} aria-hidden/>{supplier.display_name}</Link>}
 <h3><Link href={'/produits/'+p.product_id}>{p.name}</Link></h3>{p.description&&<p className="catalogue-card-description">{p.description}</p>}
 <dl className="catalogue-card-facts"><div><dt>{l('Material','Matière')}</dt><dd>{p.specifications.materials||l('To confirm','À confirmer')}</dd></div><div><dt>{l('Process','Procédé')}</dt><dd>{p.specifications.processes||l('To confirm','À confirmer')}</dd></div></dl>
 <div className="catalogue-card-meta"><span>{country?<><CountryFlag code={country}/>{countryName(country,language)}</>:l('Manufacturing country to confirm','Pays de fabrication à confirmer')}</span><span>{p.specifications.minimum_quantity?`${l('Min.','Min.')} ${p.specifications.minimum_quantity} ${p.specifications.unit||''}`:l('Quantity on request','Quantité sur demande')}</span></div>
 {p.specifications.verification==='unverified'&&<span className="catalogue-status">{l('Unverified product','Produit non vérifié')}</span>}
 <div className="catalogue-card-action"><CompareProduct id={p.product_id}/><Link href={'/produits/'+p.product_id}>{l('View product','Voir le produit')}<ArrowRight size={17} aria-hidden/></Link></div></div>
 </article>;}
export function SupplierCard({supplier:s,products=[]}:{supplier:CardSupplier;products?:CardProduct[]}){const {l,language}=useLanguage();const categoryLabel=useCategoryLabel();const categories=[...new Set(products.map(p=>p.category).filter(Boolean))];return <article className="catalogue-supplier-card">
 <div className="catalogue-company-heading"><CompanyMark supplier={s}/><div><p className="catalogue-byline">{l('Industrial company','Entreprise industrielle')}</p><h3><Link href={'/fabricants/'+s.organization_id}>{s.display_name}</Link></h3><p className="catalogue-location"><CountryFlag code={s.country_code}/>{[s.city,countryName(s.country_code,language)].filter(Boolean).join(' · ')}</p></div></div>
 <p className="catalogue-card-description">{s.description}</p>{categories.length>0&&<div className="catalogue-tags">{categories.slice(0,4).map(category=><span key={category}>{categoryLabel(category)}</span>)}</div>}
 {products.length>0&&<div className="catalogue-company-products"><span>{l('Products & capabilities','Produits et capacités')}</span>{products.slice(0,3).map(p=><Link key={p.product_id} href={'/produits/'+p.product_id}><Package size={16} aria-hidden/>{p.name}<ArrowUpRight size={14} aria-hidden/></Link>)}</div>}
 {s.public_details?.verification==='unverified'&&<span className="catalogue-status">{l('Unverified company','Entreprise non vérifiée')}</span>}
 <div className="catalogue-company-actions"><Link className="catalogue-primary" href={'/fabricants/'+s.organization_id}>{l('View manufacturer','Voir le fabricant')}<ArrowRight size={16} aria-hidden/></Link><Link className="catalogue-secondary" href={'/messagerie?supplier='+s.organization_id}>{l('Contact','Contacter')}</Link></div>
 </article>;}
