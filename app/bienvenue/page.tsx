import {Suspense} from 'react';
import BuyerOnboarding from '@/app/buyer-onboarding';
import {privatePageMetadata} from '@/lib/page-metadata';
export async function generateMetadata(){return privatePageMetadata('Your company','Votre entreprise')}
export default function Page(){return <Suspense><BuyerOnboarding/></Suspense>}
