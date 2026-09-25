import {notFound} from 'next/navigation';
import {products} from '@/lib/catalog';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const item=products.find(x=>x.id.toLowerCase()===id);return {title:(item?.name||'Page introuvable')+' | IS systems'}}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!products.some(x=>x.id.toLowerCase()===id))notFound();return null}
