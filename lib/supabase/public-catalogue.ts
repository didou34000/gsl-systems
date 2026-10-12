import {z} from 'zod';
import {createClient} from '@supabase/supabase-js';
import {runtimeConfig} from '@/lib/runtime-config';
export function publicCatalogue(){const {url,key}=runtimeConfig();return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
export async function supplierProfile(id:string){
 if(!z.string().uuid().safeParse(id).success)return null;
 const db=publicCatalogue();const {data,error}=await db.from('published_supplier_profiles').select('organization_id,display_name,country_code,city,description,processes,materials,published_at,public_details').eq('organization_id',id).is('withdrawn_at',null).maybeSingle();
 if(error)throw Error('CATALOGUE_UNAVAILABLE');return data;
}
export async function productProfile(id:string){
 if(!z.string().uuid().safeParse(id).success)return null;
 const db=publicCatalogue();const {data,error}=await db.from('published_products').select('product_id,organization_id,name,description,category,specifications,published_at').eq('product_id',id).is('withdrawn_at',null).maybeSingle();
 if(error)throw Error('CATALOGUE_UNAVAILABLE');if(!data)return null;const admission=await db.from('robotics_products').select('category,specifications').eq('product_id',id).maybeSingle();if(admission.error)throw Error('CATALOGUE_UNAVAILABLE');return admission.data?{...data,...admission.data}:data;
}

export async function supplierProducts(organization:string){const {data,error}=await publicCatalogue().from('robotics_products').select('product_id,organization_id,name,description,category,specifications,published_at').eq('organization_id',organization).is('withdrawn_at',null).limit(100);if(error)throw Error('CATALOGUE_UNAVAILABLE');return data||[];}
export async function similarProducts(product:{product_id:string;category:string;specifications:Record<string,string>}){let query=publicCatalogue().from('robotics_products').select('product_id,organization_id,name,description,category,specifications,published_at').eq('category',product.category).neq('product_id',product.product_id).is('withdrawn_at',null).limit(4);if(product.specifications.processes)query=query.contains('specifications',{processes:product.specifications.processes});const {data,error}=await query;if(error)throw Error('CATALOGUE_UNAVAILABLE');return data||[];}

export async function supplierMedia(organization:string){const {data,error}=await publicCatalogue().from('published_media').select('id,kind,caption,origin').eq('organization_id',organization).is('withdrawn_at',null).order('published_at').limit(20);if(error)throw Error('CATALOGUE_UNAVAILABLE');return data||[];}
