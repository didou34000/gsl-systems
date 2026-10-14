import {privatePageMetadata} from '@/lib/page-metadata';
import InDevelopment from './in-development';
export async function generateMetadata(){return privatePageMetadata('Transport & import','Transport et importation')}
export default function Page(){return <InDevelopment/>}
