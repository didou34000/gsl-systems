import {cookies,headers} from 'next/headers';
import type {Metadata} from 'next';
import {publicMetadata} from '@/lib/seo';
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
export async function generateMetadata():Promise<Metadata>{const language=(await cookies()).get('gsl-language')?.value==='fr'?'fr':'en';const path=(await headers()).get('x-gsl-path')||'/';return {...publicMetadata(path,language==='fr'?'GSL systems — Sourcing industriel':'GSL systems — Industrial sourcing',language==='fr'?'Trouvez des fabricants, comparez leurs capacités et préparez vos demandes de devis.':'Find manufacturers, compare production capabilities and prepare your enquiries.',language),...((await headers()).get('x-gsl-filtered')==='true'?{robots:{index:false,follow:true}}:{}),icons:{icon:'/favicon.svg?v=chain-terracotta-3',shortcut:'/favicon.svg?v=chain-terracotta-3'}};}
export default async function RootLayout({children}:{children:React.ReactNode}){const language=(await cookies()).get('gsl-language')?.value==='fr'?'fr':'en';return <html lang={language}><body><Suspense fallback={<div className="loading-page">GSL systems · Loading…</div>}><LanguageProvider initialLanguage={language}><Marketplace>{children}</Marketplace></LanguageProvider></Suspense></body></html>}
