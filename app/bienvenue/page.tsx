import {Suspense} from 'react';
import BuyerOnboarding from '@/app/buyer-onboarding';
export const metadata={title:'Votre entreprise | GSL Systems',robots:{index:false,follow:false}};
export default function Page(){return <Suspense><BuyerOnboarding/></Suspense>}
