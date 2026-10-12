import AuthForm from '@/app/auth-form';
import {privatePageMetadata} from '@/lib/page-metadata';
export async function generateMetadata(){return privatePageMetadata('Sign in','Se connecter')}
export default function Page(){return <AuthForm mode="login"/>}
