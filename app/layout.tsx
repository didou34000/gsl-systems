import type {Metadata} from 'next';
import {Suspense} from 'react';
import Marketplace from './marketplace';
import {LanguageProvider} from './language';
import './globals.css';
import './brand.css';
import './discovery.css';
export const metadata:Metadata={title:'IS systems — Industrial sourcing & marketplace',description:'Find industrial products and manufacturing capabilities. Explore product specifications, supplier profiles and locations. Private demonstration.',robots:{index:false,follow:false},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Suspense fallback={<div className="loading-page">IS systems · Loading…</div>}><LanguageProvider><Marketplace>{children}</Marketplace></LanguageProvider></Suspense></body></html>}
