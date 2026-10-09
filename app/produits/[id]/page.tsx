import {ProductProfileView} from '@/app/public-profiles';
import {notFound} from 'next/navigation';
import {productProfile,similarProducts,supplierProfile} from '@/lib/supabase/public-catalogue';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const p=await productProfile(id);return {title:(p?.name||'Référence introuvable')+' | GSL systems'}}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const p=await productProfile(id);if(!p)notFound();const [similar,manufacturer]=await Promise.all([similarProducts(p),supplierProfile(p.organization_id)]);return <ProductProfileView product={p} similar={similar} manufacturer={manufacturer}/>;}
