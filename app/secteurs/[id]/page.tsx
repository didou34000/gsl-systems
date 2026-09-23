import {notFound} from 'next/navigation';
import {sectors} from '@/lib/catalog';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const item=sectors.find(x=>x.id.toLowerCase()===id);return {title:(item?.name||'Page introuvable')+' | CD systems'}}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!sectors.some(x=>x.id.toLowerCase()===id))notFound();return null}
