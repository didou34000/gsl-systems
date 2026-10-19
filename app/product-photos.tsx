'use client';
import {useRef,useState} from 'react';
import Image from 'next/image';
import {Trash2} from 'lucide-react';
import FileDropzone from '@/components/file-dropzone';
import {useLanguage} from './language';
export default function ProductPhotos({product,value,disabled,prepare,onChange,onUploading}:{product:string;value:string[];disabled:boolean;prepare:()=>Promise<boolean>;onChange:(ids:string[])=>void;onUploading:(busy:boolean)=>void}){
 const {l}=useLanguage();const [uploading,setUploading]=useState(false),[rights,setRights]=useState(false),[error,setError]=useState('');const active=useRef(false);
 async function upload(files:File[]){
  if(disabled||active.current||!rights)return;
  if(value.length+files.length>5){setError(l('Maximum five product photos.','Cinq photos par produit maximum.'));return}
  if(files.some(f=>!f.size||f.size>3*1024*1024)){setError(l('Each image must be under 3 MB.','Chaque image doit faire moins de 3 Mo.'));return}
  if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type))){setError(l('Choose a valid JPEG, PNG or WebP image.','Choisissez une image JPEG, PNG ou WebP valide.'));return}
  active.current=true;setUploading(true);onUploading(true);setError('');let next=[...value];
  try{if(!await prepare()){setError(l('Save the product before adding photos.','Enregistrez le produit avant d’ajouter les photos.'));return}
   for(const file of files){const form=new FormData();form.set('file',file);form.set('product',product);form.set('rightsAttested','true');const r=await fetch('/api/product-images',{method:'POST',body:form});const d=await r.json() as {id?:string;error?:string};if(!r.ok||!d.id)throw Error(d.error);next=[...next,d.id];onChange(next)}
  }catch(e){setError(e instanceof Error&&e.message==='IMAGE_LIMIT'?l('Image storage limit reached. Contact GSL to clear unused images.','La limite de stockage des images est atteinte. Contactez GSL pour nettoyer les images inutilisées.'):l('The image could not be added. Photos already added are kept. Please retry.','L’image n’a pas pu être ajoutée. Les photos déjà ajoutées sont conservées. Réessayez.'))}finally{active.current=false;setUploading(false);onUploading(false)}
 }
 return <div className="sp-photos"><p className="sp-note">{l('Optional: up to five photos. They stay private until an administrator approves the product. The first photo is the cover.','Facultatif : jusqu’à cinq photos. Elles restent privées jusqu’à la validation du produit par un administrateur. La première est la couverture.')}</p>
 {error&&<p role="alert" className="sw-alert">{error}</p>}
 <div className="sp-photo-grid">{value.map((id,i)=><figure key={id}><Image unoptimized width={400} height={300} src={'/api/product-images?id='+id} alt={l('Product photo','Photo du produit')+' '+(i+1)}/><figcaption>{i===0?l('Cover photo','Photo de couverture'):<button type="button" disabled={disabled||uploading} onClick={()=>onChange([id,...value.filter(v=>v!==id)])}>{l('Use as cover','Mettre en couverture')}</button>}<button type="button" disabled={disabled||uploading} aria-label={l('Remove photo','Retirer la photo')+' '+(i+1)} onClick={()=>onChange(value.filter(v=>v!==id))}><Trash2 size={16}/></button></figcaption></figure>)}</div>
 <label className="sw-checkbox"><input type="checkbox" checked={rights} disabled={disabled||uploading} onChange={e=>setRights(e.target.checked)}/><span>{l('I have permission to publish these product photos.','Je dispose des droits pour publier ces photos du produit.')}</span></label>
 <FileDropzone label={l('Drop product photos here or browse files','Déposez les photos du produit ici ou parcourez vos fichiers')} hint={l('JPEG, PNG or WebP · 3 MB per image','JPEG, PNG ou WebP · 3 Mo par image')} multiple accept="image/jpeg,image/png,image/webp" disabled={disabled||uploading||!rights||value.length>=5} onFiles={files=>void upload(files)}/>
 {uploading&&<p role="status">{l('Adding images…','Ajout des images…')}</p>}</div>;
}
