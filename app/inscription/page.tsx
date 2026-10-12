import AuthForm from '@/app/auth-form';
import {privatePageMetadata} from '@/lib/page-metadata';
export async function generateMetadata(){return privatePageMetadata('Create an account','Créer un compte')}
export default function Page(){return <AuthForm mode="signup"/>}
