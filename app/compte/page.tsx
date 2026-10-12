import MemberDashboard from '@/app/member-dashboard';
import {privatePageMetadata} from '@/lib/page-metadata';
export async function generateMetadata(){return privatePageMetadata('My account','Mon espace')}
export default function Page(){return <MemberDashboard/>}
