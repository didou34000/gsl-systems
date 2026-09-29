import {notFound} from 'next/navigation';
import {products,suppliers} from '@/lib/catalog';
export const metadata={title:'Démonstration | GSL systems',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{slug?:string[]}>}){
 const {slug=[]}=await params;
 if(slug.length===0||slug.length===1&&['catalogue','fabricants'].includes(slug[0]))return null;
 if(slug.length===2&&(slug[0]==='produits'?products.some(p=>p.id===slug[1]):slug[0]==='fabricants'&&suppliers.some(s=>s.id===slug[1])))return null;
 notFound();
}
