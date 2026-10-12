import AuthForm from '@/app/auth-form';
import {privatePageMetadata} from '@/lib/page-metadata';
export async function generateMetadata(){return privatePageMetadata('Confirm my email','Confirmer mon email')}
export default function Page(){return <AuthForm mode="verify"/>}
