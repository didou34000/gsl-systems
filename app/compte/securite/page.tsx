import SecurityCenter from '@/app/security-center';
import {privatePageMetadata} from '@/lib/page-metadata';

export async function generateMetadata(){return privatePageMetadata('Account security','Sécurité du compte')}
export default function Page() { return <SecurityCenter/>; }
