import SupplierWorkspace from '@/app/supplier-workspace';
import {redirect} from 'next/navigation';
export const metadata={title:'Mon entreprise | GSL systems',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const query=await searchParams;if(query.etape==='produits')redirect('/mes-produits'+(query.lang==='fr'?'?lang=fr':''));return <SupplierWorkspace view="company"/>}
