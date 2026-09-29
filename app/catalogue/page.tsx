import CatalogueLive from '@/app/catalogue-live';
import {publicCatalogue} from '@/lib/supabase/public-catalogue';
import {searchSchema} from '@/lib/search-criteria';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams;const query=new URLSearchParams();for(const [k,v] of Object.entries(raw)){if(typeof v==='string')query.set(k,v)}
 const parsed=searchSchema.safeParse(Object.fromEntries([...query].filter(([k])=>k!=='lang')));
 let data={suppliers:[],count:0,page:1,error:true};
 if(parsed.success){try{const result=await publicCatalogue().rpc('search_catalogue',{criteria:parsed.data});if(!result.error)data={...result.data,error:false}}catch{/* An unavailable catalogue is not an empty catalogue. */}}
 return <CatalogueLive initialData={data} initialQuery={query.toString()}/>;
}
