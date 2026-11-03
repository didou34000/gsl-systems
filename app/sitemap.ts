import type {MetadataRoute} from 'next';
import {publicCatalogue} from '@/lib/supabase/public-catalogue';
import {sourcingCountries} from '@/lib/sourcing-coverage';
import {localizedHref} from '@/lib/i18n/languages';
import {indexable,contentLanguages} from '@/lib/seo';
import {blogArticles} from '@/lib/blog';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{if(!indexable('/'))return [];const db=publicCatalogue();const [suppliers,products]=await Promise.all([db.from('component_supplier_profiles').select('organization_id,published_at').is('withdrawn_at',null).limit(1000),db.from('component_products').select('product_id,organization_id,category,published_at').is('withdrawn_at',null).limit(1000)]);if(suppliers.error||products.error)throw Error('SITEMAP_UNAVAILABLE');const base=process.env.GSL_SITE_URL||'https://www.gsl-systems.com';
 const day=(value:string|null|undefined)=>value?new Date(value):undefined;
 const listed=(suppliers.data||[]).filter(s=>(products.data||[]).some(p=>p.organization_id===s.organization_id));
 const entries:{path:string;lastModified?:Date}[]=[...['/','/catalogue','/fabricants','/contact','/secteurs','/pays','/mentions-legales','/conditions-utilisation','/confidentialite','/cookies','/blog','/demandes'].map(path=>({path})),...blogArticles.map(a=>({path:'/blog/'+a.slug,lastModified:day(a.date+'T00:00:00Z')})),...[...new Set((products.data||[]).map(p=>p.category))].map(c=>({path:'/secteurs/'+c})),...sourcingCountries.map(c=>({path:'/pays/'+c.toLowerCase()})),...listed.map(s=>({path:'/fabricants/'+s.organization_id,lastModified:day(s.published_at)})),...(products.data||[]).map(p=>({path:'/produits/'+p.product_id,lastModified:day(p.published_at)}))];
 return entries.flatMap(({path,lastModified})=>{
 const codes=contentLanguages(path);
 const languages={...Object.fromEntries(codes.map(code=>[code,base+localizedHref(path,code)])),'x-default':base+path};
 return codes.map(code=>({url:base+localizedHref(path,code),...(lastModified?{lastModified}:{}),alternates:{languages}}));
});}
