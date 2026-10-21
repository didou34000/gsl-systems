import {flagAssets} from './country-flag';

/** Countries shown on a company's factory mark: headquarters first, then declared production sites, at most three with a flag asset. */
export function factoryCountries(country:string|undefined,sites:{country?:string}[]=[]){
 return [...new Set([country,...sites.map(s=>s.country)].filter((c):c is string=>!!c&&flagAssets.includes(c)))].slice(0,3);
}

// Flags dominate the mark so they stay readable at card size: the fewer the flags, the larger each one.
const layouts:Record<number,{poles:number[];width:number}>={1:{poles:[12],width:34},2:{poles:[4,33],width:26},3:{poles:[3,23,43],width:18}};

/** Stand-in for a company without its own image: a low factory flying the flags of its countries. */
export default function FactoryMark({countries,className='',label}:{countries:string[];className?:string;label?:string}){
 const flags=countries.slice(0,3),layout=layouts[flags.length];
 return <svg className={'factory-mark '+className} viewBox="0 0 64 64" role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} focusable="false">
  {layout&&flags.map((code,i)=><path key={code} className="factory-mark-pole" d={`M${layout.poles[i]} 47V2`}/>)}
  <path className="factory-mark-body" d="M4 61V45L23 51V45L42 51V45L60 51V61Z"/>
  <path className="factory-mark-detail" d="M9 54h5v4h-5zM18 54h5v4h-5zM41 54h5v4h-5zM50 54h5v4h-5zM29 55h6v6h-6z"/>
  <path className="factory-mark-ground" d="M1 61H63"/>
  {layout&&flags.map((code,i)=>{const x=layout.poles[i]+.6,w=layout.width,h=w*.75;return <g key={code} className="factory-mark-flag">
   <image href={'/flags/'+code.toLowerCase()+'.svg'} x={x} y={2.5} width={w} height={h} preserveAspectRatio="xMidYMid slice"/>
   <rect className="factory-mark-flag-edge" x={x} y={2.5} width={w} height={h}/>
  </g>})}
 </svg>;
}
