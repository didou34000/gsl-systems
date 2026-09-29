'use client';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import CountryFlag from '@/components/country-flag';
import {sectors} from '@/lib/catalog';
import {countryGroups} from '@/lib/onboarding/country-options';
export default function LiveDirectory({kind}:{kind:'sectors'|'countries'}){const {l,language}=useLanguage();return <main className="container operational-platform"><h1>{kind==='sectors'?l('Manufacturing sectors','Secteurs de fabrication'):l('Manufacturing locations','Lieux de fabrication')}</h1><p>{l('Explore published capabilities. A country listed here does not imply that a manufacturer is currently available.','Explorez les capacités publiées. La présence d’un pays dans cette liste ne garantit pas qu’un fabricant soit actuellement disponible.')}</p><div className="operational-grid">{kind==='sectors'?sectors.map(s=><article key={s.id}><h2><Link href={'/fabricants?category='+s.id}>{s.name}</Link></h2></article>):countryGroups.flatMap(g=>g.codes).slice(0,13).map(c=><article key={c}><h2><CountryFlag code={c}/><Link href={'/fabricants?country='+c}>{new Intl.DisplayNames([language],{type:'region'}).of(c)}</Link></h2></article>)}</div></main>}
