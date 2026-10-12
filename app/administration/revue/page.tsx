import OperationalPlatform from '@/app/operational-platform';
import {AdminFrame} from '@/app/admin-shell';
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <AdminFrame current="review"><OperationalPlatform mode='review'/></AdminFrame>}
