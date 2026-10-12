import {cookies} from 'next/headers';
import type {Metadata} from 'next';
/** Title for a non-indexed page in the visitor's language (French, otherwise English, as for editorial pages). */
export async function privatePageMetadata(en:string,fr:string,follow=false):Promise<Metadata>{const french=(await cookies()).get('gsl-language')?.value==='fr';return {title:(french?fr:en)+' | GSL systems',robots:{index:false,follow}}}
