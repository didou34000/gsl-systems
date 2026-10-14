'use client';

import {useEffect,useRef,useState} from 'react';
import {Pause,Play} from 'lucide-react';
import {useLanguage} from './language';

// User-selected Pexels clip 32386529. Decorative illustration, not a GSL supplier's factory.
const source='https://videos.pexels.com/video-files/32386529/13814862_2560_1440_100fps.mp4';
const poster='https://images.pexels.com/videos/32386529/pexels-photo-32386529.jpeg?auto=compress&dpr=1&h=750&w=1260';

export default function HeroVideo(){
 const {l}=useLanguage();
 const video=useRef<HTMLVideoElement>(null);
 const pausedByUser=useRef(false);
 const [enabled,setEnabled]=useState(false);
 const [playing,setPlaying]=useState(false);
 const [failed,setFailed]=useState(false);

 useEffect(()=>{
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;
  const update=()=>setEnabled(!motion.matches&&!connection?.saveData);
  // Subscribe to the browser's external accessibility preference after hydration.
  update();
  motion.addEventListener('change',update);
  const visibility=()=>{
   if(document.hidden)video.current?.pause();
   else if(!pausedByUser.current)void video.current?.play().catch(()=>{});
  };
  document.addEventListener('visibilitychange',visibility);
  return()=>{motion.removeEventListener('change',update);document.removeEventListener('visibilitychange',visibility);};
 },[]);

 function toggle(){
  const element=video.current;if(!element)return;
  if(element.paused){pausedByUser.current=false;void element.play().catch(()=>{});}
  else{pausedByUser.current=true;element.pause();}
 }

 return <>
  <div className="hx-video-backdrop" aria-hidden="true" style={{backgroundImage:`url("${poster}")`}}>
   {enabled&&!failed&&<video ref={video} src={source} poster={poster} autoPlay muted loop playsInline preload="none" tabIndex={-1} disablePictureInPicture onPlaying={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>setFailed(true)} />}
  </div>
  <div className="hx-video-shade" aria-hidden="true"/>
  {enabled&&!failed&&<button type="button" className="hx-video-control" onClick={toggle} aria-label={playing?l('Pause background video','Mettre la vidéo de fond en pause'):l('Play background video','Lire la vidéo de fond')}>
   {playing?<Pause size={16} aria-hidden="true"/>:<Play size={16} aria-hidden="true"/>}<span>{playing?l('Pause','Pause'):l('Play','Lecture')}</span>
  </button>}
 </>;
}
