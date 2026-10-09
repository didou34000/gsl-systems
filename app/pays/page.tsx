import {cookies} from 'next/headers';
import {resolveLanguage} from '@/lib/i18n/languages';
import {translate} from '@/lib/i18n/translations';
import {publicMetadata} from '@/lib/seo';
export async function generateMetadata(){const language=resolveLanguage((await cookies()).get('gsl-language')?.value);return publicMetadata('/pays',translate(language,'Ten sourcing countries and their EU trade agreements','Dix pays de sourcing et leurs accords commerciaux avec l’UE')+' | GSL systems',translate(language,'Agreement dates, eligible industrial goods, origin documents and import conditions. Explore the GSL sourcing network.','Dates de l’accord, produits industriels éligibles, justificatifs d’origine et conditions d’importation. Explorez le réseau de sourcing GSL.'),language);}
export default function Page(){return null;}
