import {cookies} from 'next/headers';
import Image from 'next/image';
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
  <header className="blog-intro blog-illustrated-intro">
   <Image className="blog-intro-image" src="/blog/bandeau-chiffres-fond.jpg" alt="" fill sizes="(max-width: 1400px) 100vw, 1320px" preload/>
   <div><h1>{t('Blog','Blog')}</h1><p>{t('Practical guides for buyers of robotics components: specifying, requesting quotes, importing and documenting.','Guides pratiques pour les acheteurs de composants robotiques : spécifier, demander des devis, importer et documenter.')}</p></div>
  </header>
  <ul className="blog-grid">{blogArticles.map((a,i)=><li key={a.slug}><Link href={'/blog/'+a.slug}>
   {a.cover?<Image src={a.cover} alt={pick(a.alt)} width={1600} height={900} sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"/>:<span className="blog-card-visual" aria-hidden><CategoryIcon category={icons[i%icons.length]} size={44} strokeWidth={1.2}/></span>}
   <time dateTime={a.date}>{date(a.date)}</time>
   <h2>{pick(a.title)}</h2>
   <p>{pick(a.summary)}</p>
   <span className="blog-read">{t('Read the article','Lire l’article')}<ArrowRight size={16} aria-hidden/></span>
  </Link></li>)}</ul>
  <p className="blog-visual-note">{t('Generated illustrations; they do not depict GSL products or a real team member.','Illustrations générées : elles ne représentent pas des produits GSL ni un membre réel de l’équipe.')}</p>
  <section className="blog-project" aria-labelledby="blog-project-title">
   <Image src="/blog/bande-personne.jpg" alt={t('Illustration of a technician examining a component at a workbench','Illustration d’un technicien examinant un composant sur un établi')} width={1200} height={1200} sizes="(max-width: 640px) 100vw, 300px"/>
   <div><h2 id="blog-project-title">{t('Turn your reading into a clear brief','Passez de la lecture à un besoin précis')}</h2><p>{t('Describe your components, quantities and delivery destination to prepare your sourcing request.','Décrivez vos composants, vos quantités et votre destination de livraison pour préparer votre demande de sourcing.')}</p><Link href="/decrire-mon-besoin">{t('Describe my requirement','Décrire mon besoin')}<ArrowRight size={17} aria-hidden/></Link></div>
  </section>
 </main>;
}
