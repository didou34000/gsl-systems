import Messaging from '../messaging';
import {privatePageMetadata} from '@/lib/page-metadata';
export async function generateMetadata(){return privatePageMetadata('Messages','Messagerie')}
export default function Page(){return <Messaging/>}
