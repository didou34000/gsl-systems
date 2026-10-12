import AuthForm from '@/app/auth-form';
import {privatePageMetadata} from '@/lib/page-metadata';
export async function generateMetadata(){return privatePageMetadata('New password','Nouveau mot de passe')}
export default function Page(){return <AuthForm mode="password"/>}
