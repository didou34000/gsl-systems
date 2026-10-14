import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {ArrowRight} from 'lucide-react';
import Link from '@/components/site-link';
import {blogArticle,blogArticles} from '@/lib/blog';
import {resolveLanguage,localizedHref} from '@/lib/i18n/languages';
import {translate} from '@/lib/i18n/translations';
import {publicMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
async function context(slug:string){const article=blogArticle(slug);if(!article)notFound();const language=resolveLanguage((await cookies()).get('gsl-language')?.value);return {article,language,t:(en:string,fr:string)=>translate(language,en,fr),pick:(text:{fr:string;en:string})=>language==='fr'?text.fr:text.en};}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const {article,language,pick}=await context(slug);return publicMetadata('/blog/'+article.slug,pick(article.title)+' | GSL systems',pick(article.summary),language);}
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const {article:a,language,t,pick}=await context(slug);
 const origin=process.env.GSL_SITE_URL||'https://www.gsl-systems.com';
 const date=new Intl.DateTimeFormat(language,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(a.date+'T00:00:00Z'));
 const schema={'@context':'https://schema.org','@type':'Article',headline:pick(a.title),description:pick(a.summary),datePublished:a.date,inLanguage:language==='fr'?'fr':'en',mainEntityOfPage:origin+localizedHref('/blog/'+a.slug,language),author:{'@type':'Organization',name:'GSL systems'},publisher:{'@type':'Organization',name:'GSL systems'},...(a.cover?{image:origin+a.cover}:{})};
 const others=blogArticles.filter(x=>x.slug!==a.slug).slice(0,3);
 return <main className="container blog-article">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>
  <nav className="catalogue-breadcrumb" aria-label={t('Breadcrumb','Fil d’Ariane')}><Link href="/blog">{t('Blog','Blog')}</Link></nav>
  <article>
   <header><time dateTime={a.date}>{date}</time><h1>{pick(a.title)}</h1><p className="blog-lead">{pick(a.summary)}</p>{language!=='fr'&&language!=='en'&&<p className="blog-language-note">{t('This article is available in English and French.','Cet article est disponible en anglais et en français.')}</p>}</header>
   {a.cover&&<img className="blog-cover" src={a.cover} alt={pick(a.alt)} width={1600} height={900} decoding="async"/>}
   <div className="blog-body">{a.body.map((block,i)=>block.kind==='h2'?<h2 key={i}>{pick(block.text)}</h2>:block.kind==='p'?<p key={i}>{pick(block.text)}</p>:block.kind==='list'?<ul key={i}>{block.items.map((item,j)=><li key={j}>{pick(item)}</li>)}</ul>:a.detail?<img key={i} className="blog-detail" src={a.detail} alt="" width={1200} height={800} loading="lazy" decoding="async"/>:null)}</div>
   <aside className="blog-cta"><p>{t('Need help specifying or sourcing this component?','Besoin d’aide pour spécifier ou trouver ce composant ?')}</p><Link href="/decrire-mon-besoin">{t('Describe my requirement','Décrire mon besoin')}<ArrowRight size={17} aria-hidden/></Link></aside>
  </article>
  <section className="blog-more" aria-labelledby="blog-more-title"><h2 id="blog-more-title">{t('Other articles','Autres articles')}</h2><ul>{others.map(o=><li key={o.slug}><Link href={'/blog/'+o.slug}>{pick(o.title)}<ArrowRight size={16} aria-hidden/></Link></li>)}</ul></section>
 </main>;
}
