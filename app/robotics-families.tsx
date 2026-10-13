'use client';
import Link from '@/components/site-link';
import {ArrowRight} from 'lucide-react';
import {roboticsFamilies,roboticsMetrics} from '@/lib/robotics';
import {useLanguage} from './language';
export default function RoboticsFamilies({counts}:{counts?:Record<string,number>}){
 const {l}=useLanguage();
 return <section className="container gsl-section robotics-families">
  <div className="robotics-families-head"><h1>{l('Component families','Familles de composants')}</h1><p>{l('Each family groups the parts a humanoid robot or a robotic system needs, with the criteria buyers compare.','Chaque famille regroupe les pièces dont un robot humanoïde ou un système robotique a besoin, avec les critères que les acheteurs comparent.')}</p></div>
  <ul className="robotics-family-list">{roboticsFamilies.map(f=>{const count=counts?.[f.id]||0;const metrics=(roboticsMetrics[f.id]||[]).map(m=>l(m.en,m.fr));return <li key={f.id}>
   <div><h2>{count>0?<Link href={'/catalogue?category='+f.id}>{l(f.en,f.fr)}</Link>:l(f.en,f.fr)}</h2><p>{l(f.examplesEn,f.examplesFr)}</p>{metrics.length>0&&<p className="robotics-family-criteria">{l('Compared on','Critères comparés')} : {metrics.join(', ')}</p>}</div>
   {count>0?<Link className="robotics-family-count" href={'/catalogue?category='+f.id}>{count} {l('documented offers','offres documentées')}<ArrowRight size={17} aria-hidden/></Link>:<span className="robotics-family-count is-empty">{l('No offer published yet','Aucune offre publiée pour l’instant')}</span>}
  </li>})}</ul>
  <p className="robotics-scope">{l('Admission requires an established robotics offer, a production site in the GSL non-EU scope, and dated supporting sources. A trade agreement does not certify a company or product.','L’admission exige une offre robotique établie, un site de production dans le périmètre GSL hors UE et des sources datées. Un accord commercial ne certifie ni l’entreprise ni le produit.')}</p>
  <Link className="robotics-family-project" href="/decrire-mon-besoin">{l('Not listed? Describe your robotics project','Pas encore listé ? Décrivez votre projet robotique')}<ArrowRight size={17} aria-hidden/></Link>
 </section>;
}
