import {notFound} from 'next/navigation';
import {suppliers} from '@/lib/catalog';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const item=suppliers.find(x=>x.id.toLowerCase()===id);return {title:(item?.name||'Page introuvable')+' | CD systems'}}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!suppliers.some(x=>x.id.toLowerCase()===id))notFound();return null}
