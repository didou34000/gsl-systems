/** Address search through Photon (komoot), an OpenStreetMap geocoder designed for search-as-you-type.
 *  Called only from app/api/geocode/route.ts so browsers never depend on the third party (CORS, availability, privacy).
 *  Usage policy: debounced client, at least 3 characters, few results, cached answers, "© OpenStreetMap" attribution. */
export type AddressSuggestion={id:string;label:string;line:string;postalCode:string;city:string;region:string;country:string;countryCode:string};
export const geocodeAttribution='© OpenStreetMap';
export const geocodeMinLength=3;
export const geocodeMaxLength=200;
const photonLanguages=['en','fr','de'] as const;
const defaultEndpoint='https://photon.komoot.io/api/';
// House number before the street name in these countries; after it elsewhere in Europe.
const numberFirst=new Set(['FR','LU','GB','IE','US','CA','AU','NZ','IN','MA','TN','DZ','IL','MY','SG','PH','ZA']);

/** Returns the trimmed query, or null when it is too short, too long or contains control characters. */
export function cleanQuery(raw:unknown):string|null{
 if(typeof raw!=='string')return null;
 const q=raw.replace(/\s+/g,' ').trim();
 if(q.length<geocodeMinLength||q.length>geocodeMaxLength||/[\u0000-\u001f\u007f<>]/.test(q))return null;
 return q;
}
export const cleanCountry=(raw:unknown)=>typeof raw==='string'&&/^[A-Z]{2}$/.test(raw)?raw:'';
export const photonLanguage=(raw:unknown)=>photonLanguages.find(l=>l===raw)||'default';

type PhotonProperties={osm_id?:number;osm_type?:string;osm_key?:string;osm_value?:string;type?:string;name?:string;housenumber?:string;street?:string;postcode?:string;city?:string;town?:string;village?:string;locality?:string;district?:string;county?:string;state?:string;country?:string;countrycode?:string};
const text=(v:unknown,max=160)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';

/** Maps one Photon GeoJSON feature to the fields of a delivery address. */
export function toSuggestion(feature:unknown):AddressSuggestion|null{
 const p=(feature&&typeof feature==='object'?(feature as {properties?:PhotonProperties}).properties:null)||null;
 if(!p)return null;
 const countryCode=text(p.countrycode,2).toUpperCase();
 const kind=text(p.type,40);const name=text(p.name);const street=text(p.street);const number=text(p.housenumber,20);
 // Photon types: house, street, locality, district, city, county, state, country (houses can carry osm_key "place").
 const isPlace=['city','town','village','district','county','state','country','locality'].includes(kind)||(p.osm_key==='place'&&!street&&!number&&kind!=='house');
 const city=text(p.city)||text(p.town)||text(p.village)||text(p.locality)||(isPlace&&['city','town','village','locality'].includes(kind)?name:'')||text(p.district);
 const streetLine=street?(number?(numberFirst.has(countryCode)?`${number} ${street}`:`${street} ${number}`):street):'';
 // A named place (company, building) keeps its name before the street.
 const line=isPlace?'':[name&&name!==street&&name!==city?name:'',streetLine].filter(Boolean).join(', ');
 const postalCode=text(p.postcode,32);const region=text(p.state);const country=text(p.country);
 const label=[line,[postalCode,city].filter(Boolean).join(' '),!line&&!city?name:'',region&&region!==city?region:'',country].filter(Boolean).join(', ');
 if(!label)return null;
 return {id:`${text(p.osm_type,2)}${p.osm_id??''}:${label}`.slice(0,300),label:label.slice(0,400),line:line.slice(0,400),postalCode,city,region,country,countryCode};
}

type FetchLike=(input:string,init?:{headers?:Record<string,string>;signal?:AbortSignal})=>Promise<{ok:boolean;status:number;json():Promise<unknown>}>;
export type GeocodeOptions={language?:string;country?:string;limit?:number;endpoint?:string;timeoutMs?:number;fetch?:FetchLike;userAgent?:string};

/** Queries Photon and returns at most `limit` deduplicated suggestions, the requested country first. Throws on upstream failure. */
export async function searchAddresses(query:string,options:GeocodeOptions={}):Promise<AddressSuggestion[]>{
 const limit=Math.min(Math.max(options.limit??5,1),8);
 const url=new URL(options.endpoint||defaultEndpoint);
 url.searchParams.set('q',query);url.searchParams.set('limit',String(limit+3));
 const lang=photonLanguage(options.language);if(lang!=='default')url.searchParams.set('lang',lang);
 const response=await (options.fetch||fetch as unknown as FetchLike)(url.toString(),{headers:{Accept:'application/json','User-Agent':options.userAgent||'GSL-systems/1.0 (sourcing platform address search)'},signal:AbortSignal.timeout(options.timeoutMs??4000)});
 if(!response.ok)throw Error('GEOCODER_'+response.status);
 const body=await response.json() as {features?:unknown[]};
 const seen=new Set<string>();const country=cleanCountry(options.country);
 const rows=(Array.isArray(body?.features)?body.features:[]).map(toSuggestion).filter((s):s is AddressSuggestion=>{if(!s||seen.has(s.label))return false;seen.add(s.label);return true});
 // Stable sort: suggestions in the chosen delivery country come first, the rest of the world stays available.
 return (country?[...rows.filter(r=>r.countryCode===country),...rows.filter(r=>r.countryCode!==country)]:rows).slice(0,limit);
}
