import {publicCatalogue} from '@/lib/supabase/public-catalogue';
export const dynamic='force-dynamic';
export async function GET(){try{
 const db=publicCatalogue();
 const [products,suppliers]=await Promise.all([
  db.from('published_products').select('product_id,organization_id,name,category,description,specifications').is('withdrawn_at',null).order('published_at',{ascending:false}).order('product_id').limit(6),
  db.from('published_supplier_profiles').select('organization_id,display_name,country_code,city,description').is('withdrawn_at',null).order('published_at',{ascending:false}).order('organization_id').limit(6),
 ]);
 if(products.error||suppliers.error)throw Error('CATALOGUE_UNAVAILABLE');
 const ids=[...new Set((products.data||[]).map(p=>p.organization_id))];
 const owners=ids.length?await db.from('published_supplier_profiles').select('organization_id,display_name,country_code').in('organization_id',ids).is('withdrawn_at',null):{data:[],error:null};
 if(owners.error)throw Error('CATALOGUE_UNAVAILABLE');
 // Public projections and anonymous RLS exclude drafts and withdrawn companies.
 return Response.json({products:(products.data||[]).flatMap(p=>{const manufacturer=owners.data?.find(o=>o.organization_id===p.organization_id);return manufacturer?[{...p,manufacturer}]:[]}),suppliers:suppliers.data||[]},{headers:{'Cache-Control':'no-store'}});
}catch{return Response.json({error:'CATALOGUE_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}})}}
