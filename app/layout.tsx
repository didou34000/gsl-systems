import type {Metadata} from 'next';
import {Suspense} from 'react';
import Marketplace from './marketplace';
import './globals.css';
export const metadata:Metadata={title:'CD systems — Vos partenaires industriels, sans frontières',description:'Explorez les fabricants, comparez les produits et préparez votre sourcing industriel. CD systems, plateforme B2B pour acheteurs européens.',robots:{index:false,follow:false},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body><Suspense fallback={<div className="loading-page">CD systems · Chargement…</div>}><Marketplace>{children}</Marketplace></Suspense></body></html>}
