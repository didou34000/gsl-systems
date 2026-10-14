import RequestBoard from '@/app/request-board';
import {cookies} from 'next/headers';
import {resolveLanguage} from '@/lib/i18n/languages';
import {translate} from '@/lib/i18n/translations';
import {publicMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
export async function generateMetadata(){const language=resolveLanguage((await cookies()).get('gsl-language')?.value);const t=(en:string,fr:string)=>translate(language,en,fr);return publicMetadata('/demandes',t('Buyer requests for robotics components','Demandes d’achat de composants robotiques')+' | GSL systems',t('European buyers’ requests for robotics components. Register as a manufacturer to see the details and reply through GSL.','Demandes d’acheteurs européens pour des composants robotiques. Inscrivez-vous comme fabricant pour voir le détail et répondre via GSL.'),language);}
export default function Page(){return <RequestBoard/>}
