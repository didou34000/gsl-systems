import AuthForm from '@/app/auth-form';
import {privatePageMetadata} from '@/lib/page-metadata';
export async function generateMetadata(){return privatePageMetadata('Forgot password','Mot de passe oublié')}
export default function Page(){return <AuthForm mode="reset"/>}
