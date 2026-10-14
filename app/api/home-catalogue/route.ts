import {publicCatalogue} from '@/lib/supabase/public-catalogue';
export const dynamic='force-dynamic';
export async function GET(){try{
 const db=publicCatalogue();
 const products=await db.from('component_products').select('product_id,organization_id,name,category,description,specifications').order('published_at',{ascending:false}).order('product_id').limit(12);
 const catalogue=await db.rpc('search_components_catalogue',{criteria:{}});
 if(products.error||catalogue.error)throw Error('CATALOGUE_UNAVAILABLE');
 const ids=[...new Set((products.data||[]).map(p=>p.organization_id))];
 const owners=ids.length?await db.from('component_supplier_profiles').select('organization_id,display_name,country_code').in('organization_id',ids).is('withdrawn_at',null):{data:[],error:null};
 if(owners.error)throw Error('CATALOGUE_UNAVAILABLE');
 // Public projections and anonymous RLS exclude drafts and withdrawn companies.
 return Response.json({products:(products.data||[]).flatMap(p=>{const manufacturer=owners.data?.find(o=>o.organization_id===p.organization_id);return manufacturer?[{...p,manufacturer}]:[]}),suppliers:catalogue.data?.suppliers?.slice(0,12)||[],families:catalogue.data?.families||{}},{headers:{'Cache-Control':'no-store'}});
}catch{return Response.json({error:'CATALOGUE_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}})}}
