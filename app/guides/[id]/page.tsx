import {notFound} from 'next/navigation';
import {guides} from '@/lib/catalog';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const item=guides.find(x=>x.id.toLowerCase()===id);return {title:(item?.title||'Page introuvable')+' | GSL systems'}}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!guides.some(x=>x.id.toLowerCase()===id))notFound();return null}
