import {cookies} from 'next/headers';
import {ArrowRight} from 'lucide-react';
import Link from '@/components/site-link';
import {CategoryIcon} from '@/app/catalogue-cards';
import {blogArticles} from '@/lib/blog';
import {resolveLanguage} from '@/lib/i18n/languages';
import {translate} from '@/lib/i18n/translations';
import {publicMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
async function context(){const language=resolveLanguage((await cookies()).get('gsl-language')?.value);return {language,t:(en:string,fr:string)=>translate(language,en,fr),pick:(text:{fr:string;en:string})=>language==='fr'?text.fr:text.en};}
export async function generateMetadata(){const {language,t}=await context();return publicMetadata('/blog',t('Blog: buyer guides for robotics components','Blog : guides d’achat de composants robotiques')+' | GSL systems',t('Practical guides for buyers of robotics components: specifying, requesting quotes, importing and documenting.','Guides pratiques pour les acheteurs de composants robotiques : spécifier, demander des devis, importer et documenter.'),language);}
const icons=['transmissions-guidages','actionnement-transmission','pieces-mecaniques','energie-batteries','cables-connecteurs'];
export default async function Page(){
 const {language,t,pick}=await context();
 const date=(value:string)=>new Intl.DateTimeFormat(language,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
 return <main className="container blog-page">
  <header className="blog-intro"><h1>{t('Blog','Blog')}</h1><p>{t('Practical guides for buyers of robotics components: specifying, requesting quotes, importing and documenting.','Guides pratiques pour les acheteurs de composants robotiques : spécifier, demander des devis, importer et documenter.')}</p></header>
  <ul className="blog-grid">{blogArticles.map((a,i)=><li key={a.slug}><Link href={'/blog/'+a.slug}>
   {a.cover?<img src={a.cover} alt={pick(a.alt)} width={800} height={450} loading="lazy" decoding="async"/>:<span className="blog-card-visual" aria-hidden><CategoryIcon category={icons[i%icons.length]} size={44} strokeWidth={1.2}/></span>}
   <time dateTime={a.date}>{date(a.date)}</time>
   <h2>{pick(a.title)}</h2>
   <p>{pick(a.summary)}</p>
   <span className="blog-read">{t('Read the article','Lire l’article')}<ArrowRight size={16} aria-hidden/></span>
  </Link></li>)}</ul>
 </main>;
}
