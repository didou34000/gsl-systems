import {cookies,headers} from 'next/headers';
import type {Metadata} from 'next';
import {resolveLanguage,languageDirection} from '@/lib/i18n/languages';
import {publicMetadata} from '@/lib/seo';
import {brandAssets} from '@/lib/brand';
import {Suspense} from 'react';
import Marketplace from './marketplace';
import {Analytics} from '@vercel/analytics/next';
import {LanguageProvider} from './language';
import '@fontsource-variable/inter';
import './globals.css';
import './brand.css';
import './discovery.css';
import './auth.css';
import './supplier-workspace.css';
import './home.css';
import './premium.css';
import './sourcing-network.css';
import './buyer-journey.css';
import './messaging.css';
import './member-dashboard.css';
import './admin-dashboard.css';
import './security-center.css';
import './navigation.css';
import './catalogue-experience.css';
import './country-guides.css';
import './brand-logo.css';
import './typography.css';
import './home-refresh.css';
import './ui-system.css';
import './workspace.css';
import './admin-console.css';
import './onboarding.css';
import './robotics.css';
import './sourcing-flow.css';
import './industrial-sheets.css';
import './site-footer.css';
import './blog.css';
import './request-board.css';
import './factory-mark.css';
export async function generateMetadata():Promise<Metadata>{
 const language=resolveLanguage((await cookies()).get('gsl-language')?.value),h=await headers(),path=h.get('x-gsl-path')||'/';
 const titles:Record<string,[string,string]>={'/':['Composants robotiques et devis avec livraison','Robotics components & delivery enquiries'],'/catalogue':['Composants robotiques, actionneurs, réducteurs, capteurs','Robotics components, actuators, reducers, sensors'],'/fabricants':['Fabricants de composants robotiques hors Union européenne','Non-EU robotics component manufacturers'],'/secteurs':['Familles de composants robotiques','Robotics component families']};
 const title=(titles[path]||titles['/'])[language==='fr'?0:1]+' | GSL systems';
 const description=language==='fr'?'Trouvez des fabricants de composants robotiques hors Union européenne et préparez vos devis avec livraison : qualification, prix détaillés et suivi.':'Find robotics component manufacturers outside the European Union and prepare delivery enquiries with qualification, transparent quotes and tracking.';
 return {...publicMetadata(path,title,description,language),...(h.get('x-gsl-filtered')==='true'?{robots:{index:false,follow:true}}:{}),icons:{icon:[{url:brandAssets.iconPng,type:'image/png',sizes:'32x32'},{url:brandAssets.icon,type:'image/svg+xml',sizes:'any'}],shortcut:brandAssets.shortcut,apple:{url:brandAssets.apple,type:'image/png',sizes:'180x180'}}};
}
function siteSchema(){const origin=process.env.GSL_SITE_URL||'https://www.gsl-systems.com';return {'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':origin+'/#organization',name:brandAssets.name,url:origin+'/',logo:new URL(brandAssets.logo,origin).toString()},{'@type':'WebSite','@id':origin+'/#website',name:brandAssets.name,url:origin+'/',publisher:{'@id':origin+'/#organization'},inLanguage:['en','fr']}]};}
export default async function RootLayout({children}:{children:React.ReactNode}){const language=resolveLanguage((await cookies()).get('gsl-language')?.value);const home=((await headers()).get('x-gsl-path')||'/')==='/';return <html lang={language} dir={languageDirection(language)}><body>{home&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(siteSchema()).replace(/</g,'\\u003c')}}/>}<Suspense fallback={<div className="loading-page">GSL systems · Loading…</div>}><LanguageProvider initialLanguage={language}><Marketplace>{children}</Marketplace></LanguageProvider></Suspense><Analytics/></body></html>}
