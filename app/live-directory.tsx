'use client';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import CountryFlag from '@/components/country-flag';
import {sectors} from '@/lib/catalog';
import {countryGroups} from '@/lib/onboarding/country-options';
import SourcingNetwork from './sourcing-network';

export default function LiveDirectory({kind}:{kind:'sectors'|'countries'}) {
  const {l,language}=useLanguage();
  const isCountries=kind==='countries';
  return <main>
    <div className="container operational-platform">
      <h1>{isCountries?l('Manufacturing locations','Lieux de fabrication'):l('Manufacturing sectors','Secteurs de fabrication')}</h1>
      <p>{l('Explore published capabilities. A country listed here does not imply that a manufacturer is currently available.','Explorez les capacités publiées. La présence d’un pays dans cette liste ne garantit pas qu’un fabricant soit actuellement disponible.')}</p>
      {!isCountries&&<div className="operational-grid">{sectors.map(s=><article key={s.id}><h2><Link href={'/fabricants?category='+s.id}>{s.name}</Link></h2></article>)}</div>}
    </div>
    {isCountries&&<>
      <SourcingNetwork/>
      <section className="container operational-platform" aria-labelledby="all-countries-title">
        <h2 id="all-countries-title">{l('Explore all countries','Explorer tous les pays')}</h2>
        <div className="operational-grid">{countryGroups.flatMap(g=>g.codes).slice(0,13).map(c=><article key={c}><h3><CountryFlag code={c}/><Link href={'/fabricants?country='+c}>{new Intl.DisplayNames([language],{type:'region'}).of(c)}</Link></h3></article>)}</div>
      </section>
    </>}
  </main>;
}
