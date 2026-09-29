'use client';

import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {ArrowUpRight, Pause, Play} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';

// Illustrative locations, not supplier locations or live transport routes.
const places = [
  {code:'FR', en:'France', fr:'France', lon:2.35, lat:48.86, dx:-15, dy:26, anchor:'end'},
  {code:'DE', en:'Germany', fr:'Allemagne', lon:13.4, lat:52.52, dx:14, dy:5, anchor:'start'},
  {code:'IT', en:'Italy', fr:'Italie', lon:9.19, lat:45.46, dx:12, dy:27, anchor:'start'},
  {code:'PL', en:'Poland', fr:'Pologne', lon:21.01, lat:52.23, dx:13, dy:26, anchor:'start'},
  {code:'TR', en:'Türkiye', fr:'Turquie', lon:28.98, lat:41.01, dx:12, dy:25, anchor:'start'},
  {code:'GE', en:'Georgia', fr:'Géorgie', lon:44.79, lat:41.72, dx:-12, dy:-17, anchor:'end'},
] as const;

function project(lon:number,lat:number) {
  const merc=(value:number)=>Math.log(Math.tan(Math.PI/4+value*Math.PI/360));
  return {x:(lon+13)*15,y:(merc(64)-merc(lat))*560/(merc(64)-merc(33))};
}

export default function SourcingNetwork() {
  const {l}=useLanguage();
  const section=useRef<HTMLElement>(null);
  const [selected,setSelected]=useState<string>('FR');
  const [paused,setPaused]=useState(false);
  const [visible,setVisible]=useState(false);
  const [reduced,setReduced]=useState(true);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(media.matches);
    update();
    media.addEventListener('change',update);
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:0.15});
    if(section.current)observer.observe(section.current);
    return()=>{media.removeEventListener('change',update);observer.disconnect()};
  },[]);
  const origin=places.find(place=>place.code===selected)!;
  const start=project(origin.lon,origin.lat);
  return <section ref={section} className="sourcing-network" aria-labelledby="network-title" data-animating={visible&&!paused&&!reduced}>
    <div className="container network-layout">
      <div className="network-copy">
        <p className="network-eyebrow"><span/>{l('GLOBAL SUPPLY LINK','GLOBAL SUPPLY LINK')}</p>
        <h2 id="network-title">{l('Closer to the right','Plus près du bon')}<br/><em>{l('manufacturer.','fabricant.')}</em></h2>
        <p className="network-intro">{l('From Europe to its industrial neighbours. Explore manufacturing locations and connect your project to new possibilities.','De l’Europe à ses voisins industriels. Explorez les lieux de production et ouvrez de nouvelles possibilités pour votre projet.')}</p>
        <div className="network-countries" role="group" aria-label={l('Explore a country','Explorer un pays')}>
          {places.map(place=><button key={place.code} type="button" aria-pressed={selected===place.code} onClick={()=>setSelected(place.code)}><span>{place.code}</span>{l(place.en,place.fr)}</button>)}
        </div>
        <Link className="network-link" href={'/fabricants?country='+selected}>{l('Explore manufacturers','Explorer les fabricants')}<ArrowUpRight size={19}/></Link>
      </div>
      <div className="network-visual">
        <div className="network-map-meta"><span>{l('INDUSTRIAL CONNECTIONS','CONNEXIONS INDUSTRIELLES')}</span><span>EUROPE & BEYOND</span></div>
        <div className="network-map-frame">
          <svg className="network-map" viewBox="0 0 900 560" aria-hidden="true">
            <defs>
              <pattern id="network-grid" width="45" height="45" patternUnits="userSpaceOnUse"><path d="M45 0H0V45" fill="none" stroke="#e1cbb2" strokeOpacity=".06"/></pattern>
              <radialGradient id="network-halo"><stop stopColor="#cb865e" stopOpacity=".17"/><stop offset="1" stopColor="#cb865e" stopOpacity="0"/></radialGradient>
              <filter id="network-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
            </defs>
            <rect width="900" height="560" fill="url(#network-grid)"/>
            <circle cx={start.x} cy={start.y} r="260" fill="url(#network-halo)"/>
            <image href="/maps/europe-sourcing.svg" width="900" height="560"/>
            <text x="76" y="358" className="network-ocean">ATLANTIC</text>
            <text x="388" y="520" className="network-ocean">MEDITERRANEAN</text>
            {places.filter(place=>place.code!==selected).map((place,index)=>{
              const end=project(place.lon,place.lat);
              const lift=Math.min(135,Math.hypot(end.x-start.x,end.y-start.y)*.27);
              const path=`M ${start.x} ${start.y} Q ${(start.x+end.x)/2} ${(start.y+end.y)/2-lift} ${end.x} ${end.y}`;
              return <g key={selected+place.code} style={{'--route-delay':`${index*-.9}s`,'--route-duration':`${4+index*.55}s`} as CSSProperties}>
                <path className="network-route" d={path}/>
                <path className="network-signal network-signal-glow" d={path} pathLength="100" filter="url(#network-glow)"/>
                <path className="network-signal" d={path} pathLength="100"/>
              </g>;
            })}
            {places.map((place,index)=>{
              const p=project(place.lon,place.lat);
              return <g key={place.code} className={selected===place.code?'network-node is-origin':'network-node'} style={{'--node-delay':`${index*-.7}s`} as CSSProperties}>
                <circle className="network-pulse" cx={p.x} cy={p.y} r="15"/>
                <circle className="network-node-ring" cx={p.x} cy={p.y} r={selected===place.code?11:7}/>
                <circle className="network-node-core" cx={p.x} cy={p.y} r={selected===place.code?4:3}/>
                <text x={p.x+place.dx} y={p.y+place.dy} textAnchor={place.anchor}>{l(place.en,place.fr)}</text>
              </g>;
            })}
          </svg>
          <div className="network-map-caption"><span className="network-caption-dot"/><span>{l('Sourcing starts with a connection.','Tout commence par une connexion.')}</span></div>
        </div>
        <div className="network-map-footer"><span>{l('Illustrative connections · not live shipments','Liaisons illustratives · aucun suivi de livraison')}</span>{!reduced&&<button type="button" onClick={()=>setPaused(value=>!value)} aria-label={paused?l('Play map animation','Animer la carte'):l('Pause map animation','Mettre la carte en pause')}>{paused?<Play size={14}/>:<Pause size={14}/>}<span>{paused?l('Play','Animer'):l('Pause','Pause')}</span></button>}</div>
      </div>
    </div>
  </section>;
}
