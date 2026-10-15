import CataloguePage from '../catalogue/page';
import MakersMap from '@/app/makers-map';
import {makerLocations} from '@/lib/supabase/public-catalogue';
import {isSourcingCountry} from '@/lib/sourcing-coverage';
export const dynamic='force-dynamic';
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
export default async function Page({searchParams}:Props){
 const raw=await searchParams;const country=typeof raw.country==='string'&&isSourcingCountry(raw.country)?raw.country:'';
 // The map never blocks the list: without the catalogue it still shows the manufacturers identified from public sources.
 const locations=await makerLocations().catch(()=>({available:false,makers:[]}));
 return <><CataloguePage searchParams={searchParams}/><MakersMap published={locations.makers} available={locations.available} selected={country}/></>;
}
