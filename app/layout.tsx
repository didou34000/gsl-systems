import type {Metadata} from 'next';
import {Suspense} from 'react';
import Marketplace from './marketplace';
import './globals.css';
export const metadata:Metadata={title:'CD systems — Sourcing industriel et marketplace',description:'Marketplace industrielle et préparation de sourcing accompagné pour pièces et sous-ensembles métalliques. Version privée, réseau en constitution.',robots:{index:false,follow:false},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body><Suspense fallback={<div className="loading-page">CD systems · Chargement…</div>}><Marketplace>{children}</Marketplace></Suspense></body></html>}
