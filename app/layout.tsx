import {cookies,headers} from 'next/headers';
import type {Metadata} from 'next';
import {resolveLanguage,languageDirection} from '@/lib/i18n/languages';
import {publicMetadata} from '@/lib/seo';
import {brandAssets} from '@/lib/brand';
import {Suspense} from 'react';
import Marketplace from './marketplace';
import {LanguageProvider} from './language';
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
export async function generateMetadata():Promise<Metadata>{const language=resolveLanguage((await cookies()).get('gsl-language')?.value);const path=(await headers()).get('x-gsl-path')||'/';return {...publicMetadata(path,language==='fr'?'GSL systems — Sourcing industriel':'GSL systems — Industrial sourcing',language==='fr'?'Trouvez des fabricants, comparez leurs capacités et préparez vos demandes de devis.':'Find manufacturers, compare production capabilities and prepare your enquiries.',language),...((await headers()).get('x-gsl-filtered')==='true'?{robots:{index:false,follow:true}}:{}),icons:{icon:[{url:brandAssets.iconPng,type:'image/png',sizes:'32x32'},{url:brandAssets.icon,type:'image/svg+xml',sizes:'any'}],shortcut:brandAssets.shortcut,apple:{url:brandAssets.apple,type:'image/png',sizes:'180x180'}}};}
export default async function RootLayout({children}:{children:React.ReactNode}){const language=resolveLanguage((await cookies()).get('gsl-language')?.value);return <html lang={language} dir={languageDirection(language)}><body><Suspense fallback={<div className="loading-page">GSL systems · Loading…</div>}><LanguageProvider initialLanguage={language}><Marketplace>{children}</Marketplace></LanguageProvider></Suspense></body></html>}
