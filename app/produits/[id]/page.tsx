import {ProductProfileView} from '@/app/public-profiles';
import {notFound} from 'next/navigation';
import {ReferencedProductPage} from '@/app/referenced-pages';
import {findReferencedProduct} from '@/lib/referenced-makers';
import {productProfile,similarProducts,supplierProducts,supplierProfile} from '@/lib/supabase/public-catalogue';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const ref=findReferencedProduct(id);if(ref)return {title:ref.productFr+' · '+ref.company+' | GSL systems'};const p=await productProfile(id);return {title:(p?.name||'Référence introuvable')+' | GSL systems'}}
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(findReferencedProduct(id))return <ReferencedProductPage id={id}/>;
 const p=await productProfile(id);if(!p)notFound();
 // Secondary blocks never take the product page down: each degrades to empty on its own.
 const [similar,manufacturer,makerProducts]=await Promise.all([similarProducts(p).catch(()=>[]),supplierProfile(p.organization_id).catch(()=>null),supplierProducts(p.organization_id).catch(()=>[])]);
 return <ProductProfileView product={p} similar={similar} manufacturer={manufacturer} makerProducts={makerProducts}/>;
}
