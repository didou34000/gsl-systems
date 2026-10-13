import {cookies} from 'next/headers';
import {resolveLanguage} from '@/lib/i18n/languages';
import {translate} from '@/lib/i18n/translations';
import {publicMetadata} from '@/lib/seo';
export async function generateMetadata(){const language=resolveLanguage((await cookies()).get('gsl-language')?.value);return publicMetadata('/pays',translate(language,'Ten sourcing countries and Europe’s trade with the EU','Dix pays de sourcing et les échanges de l’Europe avec l’UE')+' | GSL systems',translate(language,'The ten GSL sourcing countries and the trade framework of every European country with the EU, on an interactive map.','Les dix pays de sourcing GSL et le cadre des échanges de chaque pays d’Europe avec l’UE, sur une carte interactive.'),language);}
export default function Page(){return null;}
