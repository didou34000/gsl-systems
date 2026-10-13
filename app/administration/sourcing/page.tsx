import SourcingWorkspace from '@/app/sourcing-workspace';
import {AdminFrame} from '@/app/admin-shell';
export const metadata={title:'Sourcing, devis et livraison | GSL systems',robots:{index:false,follow:false}};
export default function Page(){return <AdminFrame current="sourcing"><SourcingWorkspace admin/></AdminFrame>}
