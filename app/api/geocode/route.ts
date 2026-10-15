import {cleanCountry,cleanQuery,geocodeAttribution,photonLanguage,searchAddresses,type AddressSuggestion} from '@/lib/geocode';
export const dynamic='force-dynamic';

// Per-instance memory: answers are shared by every visitor (addresses are public map data), and requests are throttled per client.
const cache=new Map<string,{at:number;results:AddressSuggestion[]}>();
const hits=new Map<string,{at:number;count:number}>();
const cacheTtl=24*60*60*1000,cacheMax=500,windowMs=60*1000,perWindow=40;
const json=(value:unknown,status=200,cacheSeconds=0)=>Response.json(value,{status,headers:{'Cache-Control':cacheSeconds?`public, max-age=${cacheSeconds}`:'no-store','X-Content-Type-Options':'nosniff'}});

function throttled(request:Request){
 const client=(request.headers.get('x-forwarded-for')||'').split(',')[0].trim()||request.headers.get('x-real-ip')||'local';
 const now=Date.now();const row=hits.get(client);
 if(!row||now-row.at>windowMs){hits.set(client,{at:now,count:1});if(hits.size>5000)for(const [key,value] of hits)if(now-value.at>windowMs)hits.delete(key);return false}
 row.count++;return row.count>perWindow;
}

export async function GET(request:Request){
 // Not an open proxy for other websites; a browser on this site sends same-origin (or none on direct navigation).
 const site=request.headers.get('sec-fetch-site');if(site&&!['same-origin','none'].includes(site))return json({error:'ORIGIN'},403);
 const params=new URL(request.url).searchParams;
 const query=cleanQuery(params.get('q'));if(!query)return json({error:'INVALID'},400);
 const language=photonLanguage(params.get('lang'));const country=cleanCountry(params.get('country'));
 const key=`${language}|${country}|${query.toLowerCase()}`;const cached=cache.get(key);
 if(cached&&Date.now()-cached.at<cacheTtl)return json({results:cached.results,attribution:geocodeAttribution},200,3600);
 if(throttled(request))return json({error:'RATE_LIMITED'},429);
 try{
  const results=await searchAddresses(query,{language,country,limit:5,endpoint:process.env.GEOCODER_URL||undefined});
  if(cache.size>=cacheMax)cache.delete(cache.keys().next().value!);
  cache.set(key,{at:Date.now(),results});
  return json({results,attribution:geocodeAttribution},200,3600);
 }catch{
  // The client keeps the field as plain text.
  return json({error:'UNAVAILABLE',results:[]},503);
 }
}
