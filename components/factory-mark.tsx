import {flagAssets} from './country-flag';

/** Countries shown on a company's factory mark: headquarters first, then declared production sites, at most three with a flag asset. */
export function factoryCountries(country:string|undefined,sites:{country?:string}[]=[]){
 return [...new Set([country,...sites.map(s=>s.country)].filter((c):c is string=>!!c&&flagAssets.includes(c)))].slice(0,3);
}

// Flag poles stand on the sawtooth roof peaks; one flag takes the middle peak, two take the outer ones.
const poles:Record<number,number[]>={1:[24],2:[7,41],3:[7,24,41]};

/** Stand-in for a company without its own image: a plain factory flying the flags of its countries. */
export default function FactoryMark({countries,className='',label}:{countries:string[];className?:string;label?:string}){
 const flags=countries.slice(0,3);
 return <svg className={'factory-mark '+className} viewBox="0 0 64 64" role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} focusable="false">
  <path className="factory-mark-body" d="M7 58V34L24 41V34L41 41V34L58 41V58Z"/>
  <path className="factory-mark-detail" d="M12 46h5v5h-5zM21 46h5v5h-5zM39 46h5v5h-5zM48 46h5v5h-5zM29 49h7v9h-7z"/>
  <path className="factory-mark-ground" d="M3 58H62"/>
  {flags.map((code,i)=>{const x=poles[flags.length][i];return <g key={code} className="factory-mark-flag">
   <path className="factory-mark-pole" d={`M${x} 35V4`}/>
   <image href={'/flags/'+code.toLowerCase()+'.svg'} x={x+.6} y={4.5} width={16} height={12} preserveAspectRatio="xMidYMid slice"/>
   <rect className="factory-mark-flag-edge" x={x+.6} y={4.5} width={16} height={12}/>
  </g>})}
 </svg>;
}
