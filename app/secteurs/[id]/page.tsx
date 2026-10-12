import {notFound} from 'next/navigation';
import {cookies} from 'next/headers';
import {cache} from 'react';
import CatalogueLive from '@/app/catalogue-live';
import {publicCatalogue} from '@/lib/supabase/public-catalogue';
import {roboticsFamilies} from '@/lib/robotics';
import {publicMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
const familyData=cache(async(id:string)=>{const family=roboticsFamilies.find(f=>f.id===id);if(!family)notFound();const {data,error}=await publicCatalogue().rpc('search_robotics_catalogue',{criteria:{category:id}});if(error)throw Error('CATALOGUE_UNAVAILABLE');if(!data?.count)notFound();return {family,data};});
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const {family}=await familyData(id);const fr=(await cookies()).get('gsl-language')?.value==='fr';return publicMetadata('/secteurs/'+id,(fr?family.fr:family.en)+' | GSL systems',fr?'Offres documentées pour la robotique. Critères de choix : '+family.criteria:'Documented robotics offers, technical selection criteria and manufacturer profiles.',fr?'fr':'en');}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const {family,data}=await familyData(id);const fr=(await cookies()).get('gsl-language')?.value==='fr';return <><CatalogueLive initialCategory={id} initialData={data} initialQuery={'category='+id}/><section className="container gsl-section"><h2>{fr?'Critères de présélection':'Shortlisting criteria'}</h2><p>{fr?family.criteria:'Compare the required performance, interfaces, operating conditions and the evidence covering your exact configuration.'}</p><p className="robotics-scope">{fr?'Demandez les données manquantes avant de retenir un fabricant. Une source documentaire ou un accord commercial ne remplace pas les justificatifs applicables au produit.':'Request missing data before selecting a manufacturer. Documentary sources and trade agreements do not replace evidence applicable to the product.'}</p></section></>;}
