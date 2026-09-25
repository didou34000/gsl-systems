import {notFound} from 'next/navigation';
import {countries} from '@/lib/catalog';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const item=countries.find(x=>x.code.toLowerCase()===id);return {title:(item?.name||'Page introuvable')+' | IS systems'}}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!countries.some(x=>x.code.toLowerCase()===id))notFound();return null}
