'use client';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import {useSearchParams} from 'next/navigation';
import {products,getSupplier} from '@/lib/catalog';
export default function PublicWorkspaceNotice(){
 const {l}=useLanguage();const search=useSearchParams();
 const product=products.find(p=>p.id===search.get('demo'));
 return <main className="container operator-page"><p className="eyebrow">{l('PLATFORM PREVIEW','DÉMONSTRATION DE LA PLATEFORME')}</p><h1>{l('The professional workspace is coming soon','L’espace professionnel ouvre prochainement')}</h1><div className="operator-layout"><section><p>{l('You can explore manufacturing capabilities, browse supplier examples and compare products. Accounts, enquiries and document uploads are not yet available on this public version.','Vous pouvez explorer les capacités de fabrication, consulter les exemples de fournisseurs et comparer les produits. Les comptes, les demandes et le dépôt de documents ne sont pas encore disponibles sur cette version publique.')}</p>{product&&<div className="soft-panel"><h2>{product.name}</h2><p>{getSupplier(product.supplierId).name}</p><p>{l('Your selected example is shown here. No enquiry has been sent.','Votre exemple sélectionné est conservé ici. Aucune demande n’a été envoyée.')}</p></div>}<Link className="button-link" href="/catalogue">{l('Explore products','Explorer les produits')}</Link></section><aside><h2>{l('About this demonstration','À propos de cette démonstration')}</h2><p>{l('The displayed suppliers and products are fictional examples. They are not verified manufacturers or available offers.','Les fournisseurs et produits présentés sont des exemples fictifs. Il ne s’agit pas de fabricants vérifiés ni d’offres disponibles.')}</p><Link className="text-link" href="/notre-methode">{l('Our verification method','Notre méthode de vérification')}</Link></aside></div></main>
}
