import {z} from 'zod';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {runtimeConfig} from '@/lib/runtime-config';
export function publicCatalogue(){const {url,key}=runtimeConfig();return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}

/** `admitted`: listed in the reviewed component catalogue. `not_admitted`: published by its company, reachable only by direct link. */
export type CatalogueStatus='admitted'|'not_admitted';
type Db=Pick<SupabaseClient,'from'>;
type DbError={code?:string}|null;
const productColumns='product_id,organization_id,name,description,category,specifications,published_at';
const supplierColumns='organization_id,display_name,country_code,city,description,processes,materials,published_at,public_details';
/** The component_* views are absent until their migrations are applied: PostgREST reports PGRST205, Postgres 42P01. */
export const missingRelation=(error:DbError)=>!!error&&(error.code==='PGRST205'||error.code==='42P01');
const unavailable=()=>Error('CATALOGUE_UNAVAILABLE');
const tag=<T extends object>(row:T,status:CatalogueStatus)=>({...row,catalogue_status:status});

// Direct pages only. The catalogue listing (search_components_catalogue) is not affected: admission stays an admin decision.
export async function supplierProfile(id:string,db:Db=publicCatalogue()){
 if(!z.string().uuid().safeParse(id).success)return null;
 const admitted=await db.from('component_supplier_profiles').select(supplierColumns).eq('organization_id',id).is('withdrawn_at',null).maybeSingle();
 if(admitted.error&&!missingRelation(admitted.error))throw unavailable();
 if(admitted.data)return tag(admitted.data,'admitted');
 const {data,error}=await db.from('published_supplier_profiles').select(supplierColumns).eq('organization_id',id).is('withdrawn_at',null).maybeSingle();
 if(error)throw unavailable();return data?tag(data,'not_admitted'):null;
}
export async function productProfile(id:string,db:Db=publicCatalogue()){
 if(!z.string().uuid().safeParse(id).success)return null;
 const admitted=await db.from('component_products').select(productColumns).eq('product_id',id).is('withdrawn_at',null).maybeSingle();
 if(admitted.error&&!missingRelation(admitted.error))throw unavailable();
 if(admitted.data)return tag(admitted.data,'admitted');
 const {data,error}=await db.from('published_products').select(productColumns).eq('product_id',id).is('withdrawn_at',null).maybeSingle();
 if(error)throw unavailable();return data?tag(data,'not_admitted'):null;
}
/** Offers shown on a company's own pages. A company outside the reviewed catalogue still shows what it published itself. */
export async function supplierProducts(organization:string,db:Db=publicCatalogue()){
 if(!z.string().uuid().safeParse(organization).success)return [];
 const admitted=await db.from('component_products').select(productColumns).eq('organization_id',organization).is('withdrawn_at',null).limit(100);
 if(admitted.error&&!missingRelation(admitted.error))throw unavailable();
 if(admitted.data?.length)return admitted.data.map(row=>tag(row,'admitted'));
 const {data,error}=await db.from('published_products').select(productColumns).eq('organization_id',organization).is('withdrawn_at',null).limit(100);
 if(error)throw unavailable();return (data||[]).map(row=>tag(row,'not_admitted'));
}
/** Similar offers come from the reviewed catalogue only; without it there are none to suggest. */
export async function similarProducts(product:{product_id:string;category:string;specifications:Record<string,string>},db:Db=publicCatalogue()){
 let query=db.from('component_products').select(productColumns).eq('category',product.category).neq('product_id',product.product_id).is('withdrawn_at',null).limit(4);
 if(product.specifications.processes)query=query.contains('specifications',{processes:product.specifications.processes});
 const {data,error}=await query;if(missingRelation(error))return [];if(error)throw unavailable();return (data||[]).map(row=>tag(row,'admitted'));
}
export async function supplierMedia(organization:string,db:Db=publicCatalogue()){const {data,error}=await db.from('published_media').select('id,kind,caption,origin').eq('organization_id',organization).is('withdrawn_at',null).order('published_at').limit(20);if(missingRelation(error))return [];if(error)throw unavailable();return data||[];}

export type MakerLocation={organization_id:string;display_name:string;country_code:string;city:string|null};
/** Locations of the manufacturers listed in the reviewed catalogue, for the map on /fabricants. */
export async function makerLocations(db:Db=publicCatalogue()):Promise<{available:boolean;makers:MakerLocation[]}>{
 const {data,error}=await db.from('component_supplier_profiles').select('organization_id,display_name,country_code,city').is('withdrawn_at',null).limit(1000);
 if(error)return {available:false,makers:[]};
 return {available:true,makers:(data||[]).filter((row):row is MakerLocation=>!!row&&typeof row.organization_id==='string'&&typeof row.country_code==='string')};
}
