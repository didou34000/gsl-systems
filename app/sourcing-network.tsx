'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight} from 'lucide-react';
import Link from '@/components/site-link';
import europe from '@/lib/maps/europe.json';
import {countryAgreement,agreementNames} from '@/lib/sourcing-agreements';
import {isSourcingCountry} from '@/lib/sourcing-coverage';
import {europeCountry,europeStatusText} from '@/lib/europe-trade';
import {countryOptions,countryName} from '@/lib/country-names';
import {useLanguage} from './language';
import type {Hit} from './catalogue-live';
type Group='sourcing'|'eu'|'europe';
const groupOf=(code:string):Group|null=>isSourcingCountry(code)?'sourcing':europeCountry(code)?.status==='eu'?'eu':europeCountry(code)?'europe':null;
const kosovo={fr:'Kosovo',en:'Kosovo',es:'Kosovo',pt:'Kosovo',de:'Kosovo',it:'Kosovo',tr:'Kosova',ar:'كوسوفو',hi:'कोसोवो',zh:'科索沃'} as const;
export default function SourcingNetwork(){
 const {l,language}=useLanguage();const [selected,setSelected]=useState('TR'),[attempt,setAttempt]=useState(0);
 const [result,setResult]=useState<{country:string;hits:Hit[];count:number;error:boolean}|null>(null);
 const panel=useRef<HTMLDivElement>(null);
 const sourcing=isSourcingCountry(selected);
 useEffect(()=>{if(!sourcing)return;const c=new AbortController();fetch('/api/platform?view=catalogue&country='+selected,{signal:c.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<{suppliers:Hit[];count:number}>}).then(d=>setResult({country:selected,hits:d.suppliers,count:d.count,error:false})).catch(e=>{if(e.name!=='AbortError')setResult({country:selected,hits:[],count:0,error:true})});return()=>c.abort()},[selected,sourcing,attempt]);
 const name=(code:string)=>code==='XK'?kosovo[language]:countryName(code,language);
 const date=(value:string)=>new Intl.DateTimeFormat(language,{dateStyle:'long',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
 const choose=(code:string,fromList=false)=>{setSelected(code);if(fromList&&panel.current&&panel.current.getBoundingClientRect().top<0)panel.current.scrollIntoView({behavior:'smooth',block:'start'});};
 // Kosovo is absent from the shared country labels (no ISO code): slot it in alphabetically here only.
 const ordered=countryOptions(language).map(c=>c.code);ordered.splice(Math.max(0,ordered.findIndex(code=>countryName(code,language).localeCompare(kosovo[language],language)>0)),0,'XK');
 const list=(group:Group)=>ordered.filter(code=>groupOf(code)===group);
 const agreement=countryAgreement(selected),other=europeCountry(selected),text=other&&europeStatusText[other.status];
 const pending=!result||result.country!==selected;
 const groups:[Group,string][]=[['sourcing',l('GSL sourcing countries','Pays de sourcing GSL')],['eu',l('European Union','Union européenne')],['europe',l('Other European countries','Autres pays d’Europe')]];
 return <section className="countries container">
  <header className="countries-intro"><h1>{l('Countries and their trade with the EU','Les pays et leurs échanges avec l’UE')}</h1><p>{l('GSL looks for manufacturers in ten countries outside the EU that have a trade agreement with it. The map also shows how every European country trades with the European Union.','GSL recherche des fabricants dans dix pays hors UE liés à elle par un accord commercial. La carte indique aussi comment chaque pays d’Europe commerce avec l’Union européenne.')}</p></header>
  <div className="countries-explorer">
   <figure className="countries-map">
    <svg viewBox={`0 0 ${europe.width} ${europe.height}`} role="img" aria-label={l('Map of Europe and the GSL sourcing countries. The country lists below the map give the same information.','Carte de l’Europe et des pays de sourcing GSL. Les listes de pays sous la carte donnent les mêmes informations.')}>
     <path className="countries-context" d={europe.context}/>
     {europe.countries.filter(c=>c.path).map(c=><path key={c.code} data-code={c.code} d={c.path} className={'is-'+groupOf(c.code)+(selected===c.code?' is-selected':'')} onClick={()=>choose(c.code)}><title>{name(c.code)}</title></path>)}
     {europe.countries.filter(c=>c.point).map(c=><circle key={c.code} data-code={c.code} cx={c.center[0]} cy={c.center[1]} r={selected===c.code?6:4.5} className={'countries-point is-'+groupOf(c.code)+(selected===c.code?' is-selected':'')} onClick={()=>choose(c.code)}><title>{name(c.code)}</title></circle>)}
     {europe.countries.filter(c=>c.code===selected).map(c=><text key={c.code} x={c.center[0]} y={c.center[1]-(c.point?12:0)} className="countries-label" textAnchor="middle" dominantBaseline="middle">{name(c.code)}</text>)}
    </svg>
    <figcaption className="countries-legend"><span><i className="is-sourcing"/>{l('GSL sourcing countries','Pays de sourcing GSL')}</span><span><i className="is-eu"/>{l('European Union','Union européenne')}</span><span><i className="is-europe"/>{l('Other European countries','Autres pays d’Europe')}</span></figcaption>
   </figure>
   <div className="countries-panel" ref={panel} aria-live="polite">
    <p className="countries-kind">{sourcing?l('GSL sourcing country','Pays de sourcing GSL'):other?.status==='eu'?l('European Union','Union européenne'):l('European country','Pays d’Europe')}</p>
    <h2>{name(selected)}</h2>
    {agreement?<>
     <dl><div><dt>{l('Agreement with the EU','Accord avec l’UE')}</dt><dd>{l(agreementNames[agreement.kind][0],agreementNames[agreement.kind][1])}</dd></div><div><dt>{l('Entry into force','Entrée en vigueur')}</dt><dd><time dateTime={agreement.effective}>{date(agreement.effective)}</time></dd></div></dl>
     <p>{l(...agreement.note)}</p>
     <div className="countries-actions"><Link className="button-link" href={'/fabricants?country='+selected}>{l('View manufacturers','Voir les fabricants')}<ArrowRight size={16}/></Link><Link className="catalogue-help-link" href={'/pays/'+selected.toLowerCase()}>{l('Read the country guide','Lire le guide pays')}<ArrowRight size={16}/></Link></div>
     <div className="countries-results">{pending?<p role="status">{l('Loading profiles…','Chargement des fiches…')}</p>:result.error?<p>{l('Catalogue temporarily unavailable','Catalogue momentanément indisponible')} <button onClick={()=>setAttempt(n=>n+1)}>{l('Try again','Réessayer')}</button></p>:result.count===0?<p>{l('This country is in our sourcing scope. No manufacturer profile is published yet.','Ce pays fait partie de notre périmètre de sourcing. Aucune fiche fabricant n’y est encore publiée.')}</p>:<><p>{result.count} {l('published profiles','fiches publiées')}</p>{result.hits.slice(0,3).map(h=><Link key={h.organization_id} href={'/fabricants/'+h.organization_id}>{h.display_name}<ArrowUpRight size={16}/></Link>)}</>}</div>
    </>:other&&text?<>
     <dl><div><dt>{l('Trade with the EU','Échanges avec l’UE')}</dt><dd>{l(...text.title)}</dd></div>{other.since&&text.since&&<div><dt>{l(...text.since)}</dt><dd><time dateTime={other.since}>{date(other.since)}</time></dd></div>}{other.provisional&&<div><dt>{l('Provisionally applied since','Appliqué à titre provisoire depuis')}</dt><dd><time dateTime={other.provisional}>{date(other.provisional)}</time></dd></div>}</dl>
     <p>{l(...text.note)}</p>
     <p className="countries-scope">{l('This country is outside the GSL supplier scope. No manufacturer profile is published for it.','Ce pays est hors du périmètre fournisseurs de GSL. Aucune fiche fabricant n’y est publiée.')}</p>
    </>:null}
   </div>
  </div>
  <div className="countries-lists">{groups.map(([group,title])=><div key={group}><h2>{title} <span>{list(group).length}</span></h2><ul>{list(group).map(code=><li key={code}><button type="button" aria-pressed={selected===code} onClick={()=>choose(code,true)}><i className={'is-'+group}/>{name(code)}</button></li>)}</ul></div>)}</div>
  <footer className="countries-footer"><p>{l('Country guides','Guides pays')}: {list('sourcing').map((code,i)=><span key={code}>{i>0&&', '}<Link href={'/pays/'+code.toLowerCase()}>{name(code)}</Link></span>)}.</p><p>{l('Coloured countries show our commercial scope and each country’s trade framework with the EU, not verified factory locations. Cartography:','Les couleurs indiquent notre périmètre commercial et le cadre des échanges de chaque pays avec l’UE, pas des implantations d’usines vérifiées. Cartographie :')} <a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a>.</p></footer>
 </section>;
}
