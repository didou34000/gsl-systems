import type {MetadataRoute} from 'next';
import {publicCatalogue} from '@/lib/supabase/public-catalogue';
import {sourcingCountries} from '@/lib/sourcing-coverage';
import {languageOptions,localizedHref} from '@/lib/i18n/languages';
import {indexable} from '@/lib/seo';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{if(!indexable('/'))return [];const db=publicCatalogue();const [suppliers,products]=await Promise.all([db.from('published_supplier_profiles').select('organization_id,published_at').is('withdrawn_at',null).limit(1000),db.from('published_products').select('product_id,published_at').is('withdrawn_at',null).limit(1000)]);if(suppliers.error||products.error)throw Error('SITEMAP_UNAVAILABLE');const base=process.env.GSL_SITE_URL||'https://www.gsl-systems.com';const paths=['/','/catalogue','/fabricants','/contact','/pays',...sourcingCountries.map(c=>'/pays/'+c.toLowerCase()),...(suppliers.data||[]).map(s=>'/fabricants/'+s.organization_id),...(products.data||[]).map(p=>'/produits/'+p.product_id)];return paths.flatMap(path=>{
 const languages={...Object.fromEntries(languageOptions.map(({code})=>[code,base+localizedHref(path,code)])),'x-default':base+path};
 return languageOptions.map(({code})=>({url:base+localizedHref(path,code),alternates:{languages}}));
});}
