import type {Metadata} from 'next';
import {Suspense} from 'react';
import Marketplace from './marketplace';
import './globals.css';
import './brand.css';
export const metadata:Metadata={title:'IS systems — Sourcing industriel et marketplace',description:'Marketplace industrielle et préparation de sourcing accompagné pour pièces et sous-ensembles métalliques. Version privée, réseau en constitution.',robots:{index:false,follow:false},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body><Suspense fallback={<div className="loading-page">IS systems · Chargement…</div>}><Marketplace>{children}</Marketplace></Suspense></body></html>}
