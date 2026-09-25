'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Pause,Play} from 'lucide-react';
import {HomeCatalogues,type Actions} from './discovery';
import {useLanguage} from './language';
import Link from '@/components/site-link';
export default function IndustrialHome({actions}:{actions:Actions}){
 const {l}=useLanguage();
 const video=useRef<HTMLVideoElement>(null),[playing,setPlaying]=useState(false),[src,setSrc]=useState('');
 useEffect(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),small=matchMedia('(max-width: 760px)');
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
  if(reduce.matches||connection?.saveData||connection?.effectiveType==='2g')return;
  // Request the film only after the page is usable. The poster remains visible.
  const timer=window.setTimeout(()=>setSrc(small.matches?'/media/industrial-mobile.mp4':'/media/industrial-desktop.mp4'),1000);
  const stop=()=>{if(reduce.matches){clearTimeout(timer);video.current?.pause()}};reduce.addEventListener('change',stop);
  return()=>{clearTimeout(timer);reduce.removeEventListener('change',stop)};
 },[]);
 useEffect(()=>{if(src)video.current?.play().catch(()=>setPlaying(false))},[src]);
 function toggle(){if(playing){video.current?.pause();return}if(!src)setSrc(matchMedia('(max-width:760px)').matches?'/media/industrial-mobile.mp4':'/media/industrial-desktop.mp4');else video.current?.play().catch(()=>setPlaying(false))}
 return <main className="industrial-home">
 <section className="film-hero" aria-label={l('Find manufacturers','Recherche de fabricants')}><img className="film-poster" src="/media/industrial-poster.jpg" alt={l('Metal part cutting — illustration','Découpe d’une pièce métallique — image d’illustration')} fetchPriority="high"/><video ref={video} src={src||undefined} poster="/media/industrial-poster.jpg" muted playsInline loop preload="none" aria-hidden="true" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>setPlaying(false)}/><div className="film-shade"/><div className="film-content container"><p className="film-eyebrow">{l('GSL SYSTEMS / INDUSTRIAL SOURCING','GSL SYSTEMS / SOURCING INDUSTRIEL')}</p><h1>{l('Find a manufacturer for your industrial parts.','Trouvez un fabricant pour vos pièces industrielles.')}</h1><p className="film-description">{l('Explore manufacturers’ products or prepare your sourcing project with GSL systems.','Explorez les offres des fabricants ou confiez votre recherche de sous-traitants à GSL systems.')}</p><div className="hero-choice"><Link className="button-link" href="/demande-de-devis?mode=assisted">{l('Describe your project','Décrire mon besoin')} <ArrowRight size={18}/></Link><Link className="hero-secondary" href="/catalogue">{l('Explore the marketplace','Explorer la marketplace')} <ArrowRight size={18}/></Link></div><p className="hero-launch">{l('For European machinery and equipment businesses. Planned launch in Türkiye · supplier network under development.','Entreprises européennes de machines et d’équipements · Turquie envisagée pour le lancement. Réseau à constituer et qualifier.')}</p></div><div className="film-bottom container"><span>{l('Illustrative film · no supplier factory represented','Film d’illustration · aucun atelier fournisseur représenté')}</span><button type="button" onClick={toggle} aria-label={playing?l('Pause film','Mettre la vidéo en pause'):l('Play industrial film','Lire la vidéo industrielle')}>{playing?<Pause size={16}/>:<Play size={16}/>}<span>{playing?'Pause':l('Play film','Lire la vidéo')}</span></button></div></section>
 <HomeCatalogues actions={actions}/>
 </main>
}
