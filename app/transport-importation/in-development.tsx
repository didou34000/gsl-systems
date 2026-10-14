'use client';
import {ArrowRight,Construction} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from '../language';
/** Shown instead of the transport page while the service is being built. */
export default function InDevelopment(){
 const {l}=useLanguage();
 return <main className="container in-development"><Construction size={28} aria-hidden/><h1>{l('Transport & import','Transport et importation')}</h1><p>{l('This service is in development and not open yet.','Ce service est en développement et n’est pas encore ouvert.')}</p><Link className="button-link" href="/catalogue">{l('Explore the catalogue','Explorer le catalogue')}<ArrowRight size={16} aria-hidden/></Link></main>;
}
