import sharp from 'sharp';
import {fileMime} from './signature';
export async function derivePublicImage(bytes:Uint8Array){
 const mime=fileMime(bytes);if(!mime||mime==='application/pdf')throw Error('RASTER_IMAGE_REQUIRED');
 return sharp(bytes,{limitInputPixels:40000000,animated:false,failOn:'warning'}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
}
