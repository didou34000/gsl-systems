import {publicDeployment} from '@/lib/hosting';
import {redirect} from 'next/navigation';
import BusinessPortal from '@/app/business-portal';
export const metadata={title:'Espace professionnel | GSL systems',robots:{index:false,follow:false}};
export default function Page(){if(publicDeployment)redirect('/operations');return <BusinessPortal/>}
