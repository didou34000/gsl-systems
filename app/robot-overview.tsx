'use client';
import {useState} from 'react';
import Link from '@/components/site-link';
import {roboticsFamilies} from '@/lib/robotics';
import {useLanguage} from './language';

/** Where each family sits on a humanoid, in the 1000×640 drawing space. Labels stay on a physical side so leader lines never cross; leaders are drawn over the body so each one visibly reaches its point. */
const anchors:Record<string,{x:number;y:number;side:'left'|'right';label:number}>={
 'capteurs-vision':{x:488,y:62,side:'left',label:62},
 'transmissions-guidages':{x:399,y:246,side:'left',label:226},
 prehension:{x:391,y:378,side:'left',label:388},
 'pieces-mecaniques':{x:467,y:528,side:'left',label:548},
 'cables-connecteurs':{x:510,y:108,side:'right',label:62},
 'actionnement-transmission':{x:586,y:140,side:'right',label:178},
 'commande-electronique':{x:516,y:196,side:'right',label:292},
 'energie-batteries':{x:500,y:288,side:'right',label:406},
};
/** Limb segments as [x1,y1,x2,y2,thickness]. */
const limbs:[number,number,number,number,number][]=[
 [414,140,399,246,26],[399,246,392,344,22],[586,140,601,246,26],[601,246,608,344,22],
 [474,352,468,470,36],[468,470,466,578,28],[526,352,532,470,36],[532,470,534,578,28],
];

export default function RobotOverview(){
 const {l}=useLanguage();
 const [active,setActive]=useState<string|null>(null);
 const families=roboticsFamilies.filter(f=>anchors[f.id]);
 return <figure className="robot-overview" aria-label={l('Where each family sits in a humanoid robot','Où chaque famille intervient dans un robot humanoïde')}>
  <div className="robot-overview-stage">
   <svg viewBox="0 0 1000 640" aria-hidden focusable="false">
    <g className="robot-overview-body">
     {limbs.map(([x1,y1,x2,y2,w],i)=><line key={'o'+i} className="robot-limb-outline" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={w+2.8}/>)}
     {limbs.map(([x1,y1,x2,y2,w],i)=><line key={'i'+i} className="robot-limb-fill" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={w}/>)}
     <path d="M444 612h42v-14a8 8 0 0 0-8-8h-26a8 8 0 0 0-8 8zM514 612h42v-14a8 8 0 0 0-8-8h-26a8 8 0 0 0-8 8z"/>
     <path d="M382 352h20l3 28-5 20h-12l-8-18zM598 352h20l2 30-8 18h-12l-5-20z"/>
     <path d="M448 316h104l-12 40h-80z"/>
     <rect x="466" y="266" width="68" height="44" rx="9"/>
     <path d="M428 122q72-12 144 0l-6 74q-6 44-26 66h-80q-20-22-26-66z"/>
     <path className="robot-detail" d="M500 124v130M454 150q46 14 92 0M466 288h68"/>
     <rect x="490" y="94" width="20" height="22" rx="4"/>
     <rect x="474" y="28" width="52" height="70" rx="24"/>
     <path className="robot-detail" d="M480 52h40v14a6 6 0 0 1-6 6h-28a6 6 0 0 1-6-6z"/>
     {[[414,140,19],[586,140,19],[399,246,10],[601,246,10],[468,470,13],[532,470,13]].map(([cx,cy,r])=><circle key={cx+'-'+cy} className="robot-joint" cx={cx} cy={cy} r={r}/>)}
    </g>
    <g className="robot-overview-leaders">{families.map(f=>{const a=anchors[f.id];const x=a.side==='left'?306:694;return <polyline key={f.id} className={active===f.id?'is-active':undefined} points={`${a.x},${a.y} ${a.side==='left'?a.x-24:a.x+24},${a.label} ${x},${a.label}`}/>;})}</g>
    <g className="robot-overview-points">{families.map(f=>{const a=anchors[f.id];return <g key={f.id} className={active===f.id?'is-active':undefined}><circle className="robot-point-ring" cx={a.x} cy={a.y} r={13}/><circle className="robot-point" cx={a.x} cy={a.y} r={5}/></g>;})}</g>
   </svg>
   <ul className="robot-overview-labels">{families.map(f=>{const a=anchors[f.id];return <li key={f.id} className={'is-'+a.side} style={{top:(a.label/640*100)+'%'}}>
    <Link href={'/catalogue?category='+f.id} onMouseEnter={()=>setActive(f.id)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(f.id)} onBlur={()=>setActive(null)} className={active===f.id?'is-active':undefined}><strong>{l(f.en,f.fr)}</strong><span>{l(f.examplesEn,f.examplesFr)}</span></Link>
   </li>;})}</ul>
  </div>
 </figure>;
}
