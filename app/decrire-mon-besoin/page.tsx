import RequirementBuilder from '../requirement-builder';
import {privatePageMetadata} from '@/lib/page-metadata';
export async function generateMetadata(){return privatePageMetadata('Describe my requirement','Décrire mon besoin',true)}
export default function Page(){return <RequirementBuilder/>}
