'use client';
import Link from '@/components/site-link';
import CountryFlag from '@/components/country-flag';
import europe from '@/lib/maps/europe.json';
import {makerPoint} from '@/lib/maps/maker-cities';
import {referencedMakers} from '@/lib/referenced-makers';
import {isSourcingCountry,sourcingCountries} from '@/lib/sourcing-coverage';
import {countryName} from '@/lib/country-names';
import type {MakerLocation} from '@/lib/supabase/public-catalogue';
import {ArrowRight} from 'lucide-react';
import {useLanguage} from './language';
import './makers-map.css';

type Kind='published'|'referenced';
type Maker={id:string;name:string;country:string;city:string;kind:Kind};
type Marker={key:string;kind:Kind;x:number;y:number;country:string;place:string;precision:'city'|'country';makers:Maker[]};
// The sourcing countries sit between Morocco, Moldova, Georgia and Egypt: the map is cropped to that band.
const view={x:150,y:250,width:800,height:500};

const radius=(m:Marker)=>Math.min(15,9+2*(m.makers.length-1));
function markersOf(makers:Maker[]){
 const groups=new Map<string,Marker>();
 for(const maker of makers){
  const point=makerPoint(maker.country,maker.city);if(!point)continue;
  const key=maker.kind+':'+point.x+','+point.y;
  const marker=groups.get(key)||{key,kind:maker.kind,x:point.x,y:point.y,country:maker.country,place:point.precision==='city'?maker.city.split(/[(,]/)[0].trim():'',precision:point.precision,makers:[]};
  marker.makers.push(maker);groups.set(key,marker);
 }
 const list=[...groups.values()];
 // A published and an identified marker at the same place stay side by side instead of hiding each other.
 for(const m of list)if(m.kind==='referenced')for(let step=0;step<12&&list.some(o=>o.kind==='published'&&Math.hypot(o.x-m.x,o.y-m.y)<radius(o)+radius(m)+2);step++)m.x+=3;
 return list.sort((a,b)=>a.kind===b.kind?b.makers.length-a.makers.length:a.kind==='referenced'?-1:1);
}

export default function MakersMap({published,available,selected=''}:{published:MakerLocation[];available:boolean;selected?:string}){
 const {l,language}=useLanguage();
 const identified=[...new Map(referencedMakers.map(m=>[m.company+'|'+m.country,m])).values()];
 const makers:Maker[]=[
  ...published.map(m=>({id:m.organization_id,name:m.display_name,country:m.country_code,city:m.city||'',kind:'published' as const})),
  ...identified.map(m=>({id:m.id,name:m.company,country:m.country,city:m.city,kind:'referenced' as const})),
 ];
 const markers=markersOf(makers);
 const countries=[...new Set(makers.map(m=>m.country))].sort((a,b)=>countryName(a,language).localeCompare(countryName(b,language),language));
 const empty=sourcingCountries.filter(code=>!countries.includes(code));
 const filter=(code:string)=>'/fabricants?country='+code+'#carte-fabricants';
 const count=(n:number,kind:Kind)=>n+' '+(kind==='published'?(n>1?l('published manufacturers','fabricants publiés'):l('published manufacturer','fabricant publié')):(n>1?l('identified manufacturers, unverified','fabricants repérés, non vérifiés'):l('identified manufacturer, unverified','fabricant repéré, non vérifié')));
 const markerTitle=(m:Marker)=>[m.place||countryName(m.country,language),count(m.makers.length,m.kind),m.makers.map(x=>x.name).join(', '),m.precision==='country'?l('Approximate position: country centre','Position approximative : centre du pays'):''].filter(Boolean).join(' · ');
 return <section className="container makers-map" id="carte-fabricants" aria-labelledby="makers-map-title">
  <header className="makers-map-head"><h2 id="makers-map-title">{l('Where the manufacturers are','Où se trouvent les fabricants')}</h2><p>{l('Manufacturers published on GSL and manufacturers identified from public sources, placed at their declared city, or at the centre of their country when the city is not recognised.','Fabricants publiés sur GSL et fabricants repérés dans des sources publiques, placés à leur ville déclarée, ou au centre de leur pays quand la ville n’est pas reconnue.')}</p></header>
  {!available&&<p className="makers-map-alert" role="note">{l('Published profiles could not be loaded. Only manufacturers identified from public sources are placed on the map.','Les fiches publiées n’ont pas pu être chargées. Seuls les fabricants repérés dans des sources publiques sont placés sur la carte.')}</p>}
  <div className="makers-map-layout">
   <figure className="makers-map-figure">
    <svg viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-label={l('Map of manufacturer locations. The list next to the map gives the same information.','Carte des implantations des fabricants. La liste à côté de la carte donne les mêmes informations.')}>
     <path className="makers-map-context" d={europe.context}/>
     {europe.countries.filter(c=>c.path).map(c=><path key={c.code} d={c.path} className={isSourcingCountry(c.code)?(selected===c.code?'is-sourcing is-selected':'is-sourcing'):'is-other'}/>)}
     {markers.map(m=>{const r=radius(m);return <Link key={m.key} href={filter(m.country)} className={'makers-map-marker is-'+m.kind+(m.precision==='country'?' is-approximate':'')}>
      <title>{markerTitle(m)}</title>
      <circle cx={m.x} cy={m.y} r={r}/>
      <text x={m.x} y={m.y} textAnchor="middle" dominantBaseline="central">{m.makers.length}</text>
     </Link>})}
    </svg>
    <figcaption className="makers-map-legend"><span><i className="is-published"/>{l('Published on GSL','Publié sur GSL')}</span><span><i className="is-referenced"/>{l('Identified from public sources, unverified','Repéré dans des sources publiques, non vérifié')}</span><span><i className="is-sourcing"/>{l('GSL sourcing countries','Pays de sourcing GSL')}</span></figcaption>
   </figure>
   <div className="makers-map-list">
    {selected&&<Link className="makers-map-reset" href="/fabricants#carte-fabricants">{l('All countries','Tous les pays')}</Link>}
    {countries.map(code=>{const here=makers.filter(m=>m.country===code);const own=here.filter(m=>m.kind==='published'),found=here.filter(m=>m.kind==='referenced');return <div key={code} className={'makers-map-country'+(selected===code?' is-selected':'')}>
     <h3><CountryFlag code={code}/>{countryName(code,language)}</h3>
     <p>{[own.length?count(own.length,'published'):'',found.length?count(found.length,'referenced'):''].filter(Boolean).join(' · ')}</p>
     <ul>{own.map(m=><li key={m.id}><Link href={'/fabricants/'+m.id}>{m.name}</Link>{m.city&&<span>{m.city}</span>}</li>)}{found.map(m=><li key={m.id}><strong>{m.name}</strong><span>{m.city} · {l('Not registered, unverified','Non inscrit, non vérifié')}</span></li>)}</ul>
     {isSourcingCountry(code)&&selected!==code&&<Link className="makers-map-filter" href={filter(code)}>{l('Show this country’s manufacturers','Voir les fabricants de ce pays')}<ArrowRight size={15} aria-hidden/></Link>}
    </div>})}
    {empty.length>0&&<p className="makers-map-empty">{l('Sourcing countries with no manufacturer listed yet:','Pays de sourcing sans fabricant référencé pour l’instant :')} {empty.map(code=>countryName(code,language)).join(', ')}.</p>}
   </div>
  </div>
  <p className="makers-map-note">{l('Positions show the city declared by the company, not a verified factory location. Cartography:','Les positions indiquent la ville déclarée par l’entreprise, pas un site d’usine vérifié. Cartographie :')} <a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a>.</p>
 </section>;
}
