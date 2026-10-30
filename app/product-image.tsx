'use client';
import type {ProductImage} from '@/lib/referenced-makers';
import {useLanguage} from './language';

/** Product picture with a caption that says what it is and who owns it. */
export default function ProductPicture({image,alt,className,linkCredit=true}:{image:ProductImage;alt:string;className?:string;linkCredit?:boolean}){
 const {l}=useLanguage();
 // Inside a card that is itself a link, the credit stays plain text (the full source is on /credits).
 return <figure className={'product-picture'+(image.generated?' is-generated':'')+(className?' '+className:'')}>
  <img src={image.src} alt={image.kind==='illustration'?l('Illustration, not this product','Illustration, pas ce produit')+' : '+alt:alt} width={image.generated?1536:undefined} height={image.generated?1024:undefined} loading="lazy" decoding="async"/>
  <figcaption>{image.kind==='illustration'?l('Illustration, not this product','Illustration, pas ce produit'):l('Manufacturer photo, used with permission','Photo du fabricant, utilisée avec son accord')} · {linkCredit&&image.sourceUrl.startsWith('/')&&!image.sourceUrl.startsWith('//')?<a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a>:image.credit}, {image.generated?l('AI-generated visual','Visuel généré par IA'):image.license}</figcaption>
 </figure>;
}
