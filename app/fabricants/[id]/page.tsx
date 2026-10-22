import {notFound,redirect} from 'next/navigation';
import {ReferencedMakerPage} from '@/app/referenced-pages';
import {findReferencedMaker} from '@/lib/referenced-makers';
import {SupplierProfileView} from '@/app/public-profiles';
import {supplierProfile,supplierProducts,supplierMedia} from '@/lib/supabase/public-catalogue';
import {localizedHref,resolveLanguage} from '@/lib/i18n/languages';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const ref=findReferencedMaker(id);if(ref)return {title:ref[0].company+' | GSL systems'};const s=await supplierProfile(id);return {title:(s?.display_name||'Fabricant introuvable')+' | GSL systems'}}
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{lang?:string}>}){
 const {id}=await params;
 if(findReferencedMaker(id))return <ReferencedMakerPage id={id}/>;
 const s=await supplierProfile(id);if(!s)notFound();
 const slug=s.public_details?.reference_slug;
 if(typeof slug==='string'&&findReferencedMaker(slug)){
  const {lang}=await searchParams;
  redirect(localizedHref('/fabricants/'+slug,resolveLanguage(lang)));
 }
 const [products,media]=await Promise.all([supplierProducts(id),supplierMedia(id)]);
 return <SupplierProfileView supplier={s} products={products} media={media}/>;
}
