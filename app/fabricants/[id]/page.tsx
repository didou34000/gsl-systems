import {notFound} from 'next/navigation';
import {SupplierProfileView} from '@/app/public-profiles';
import {supplierProfile,supplierProducts,supplierMedia} from '@/lib/supabase/public-catalogue';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const s=await supplierProfile(id);return {title:(s?.display_name||'Fabricant introuvable')+' | GSL systems'}}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const s=await supplierProfile(id);if(!s)notFound();const [products,media]=await Promise.all([supplierProducts(id),supplierMedia(id)]);return <SupplierProfileView supplier={s} products={products} media={media}/>;}
