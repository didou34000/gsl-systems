'use client';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import {sectors} from '@/lib/catalog';
import SourcingNetwork from './sourcing-network';
export default function LiveDirectory({kind}:{kind:'sectors'|'countries'}) {
 const {l}=useLanguage();
 if(kind==='countries')return <main><SourcingNetwork/></main>;
 return <main className="container operational-platform"><h1>{l('Manufacturing sectors','Secteurs de fabrication')}</h1><p>{l('Explore published capabilities.','Explorez les capacités publiées.')}</p><div className="operational-grid">{sectors.map(s=><article key={s.id}><h2><Link href={'/fabricants?category='+s.id}>{s.name}</Link></h2></article>)}</div></main>;
}
