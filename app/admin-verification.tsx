'use client';
import {useState} from 'react';
import {BadgeCheck,LoaderCircle,Undo2} from 'lucide-react';
import Link from '@/components/site-link';
import {roboticsFamilies} from '@/lib/robotics';
import {useLanguage} from './language';

type Props={kind:'company'|'product';id:string;verified:boolean;defaultSite?:string;onDone:(status:'verified'|'unverified')=>void};

/** Administrator verification of a published company or product. PostgreSQL re-checks role, AAL2 and every field. */
export default function AdminVerification({kind,id,verified,defaultSite='',onDone}:Props){
 const {l}=useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[form,setForm]=useState(false),[confirmUndo,setConfirmUndo]=useState(false);
 async function send(body:Record<string,string>){
  setBusy(true);setError('');
  try{const response=await fetch('/api/admin/verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...body})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||'UNAVAILABLE');setForm(false);setConfirmUndo(false);onDone(body.action.endsWith('.verify')?'verified':'unverified')}
  catch(e){setError(e instanceof Error?e.message:'UNAVAILABLE')}finally{setBusy(false)}
 }
 const messages:Record<string,string>={
  MFA_REQUIRED:l('Two-factor verification is required for this action.','La vérification à deux facteurs est requise pour cette action.'),
  ADMIN_REQUIRED:l('An active owner or administrator account is required.','Un compte propriétaire ou administrateur actif est requis.'),
  PERMISSION_REQUIRED:l('Only owners and administrators can verify.','Seuls les propriétaires et administrateurs peuvent vérifier.'),
  NOT_CONFIGURED:l('Verification is not installed on this database yet: the migration must be applied.','La vérification n’est pas encore installée sur cette base : la migration doit être appliquée.'),
  COUNTRY_OUTSIDE_SCOPE:l('The production country is outside the countries covered by GSL.','Le pays de production est hors des pays couverts par GSL.'),
  COMPANY_REQUIRED:l('The company of this product is no longer published.','L’entreprise de ce produit n’est plus publiée.'),
  NOT_FOUND:l('This item is no longer published.','Cet élément n’est plus publié.'),
  INVALID:l('Check the fields: robotics use of at least 21 characters, a source URL starting with http, and no contact details.','Vérifiez les champs : usage robotique d’au moins 21 caractères, URL de source commençant par http, et aucune coordonnée.'),
 };
 const errorText=error&&(messages[error]||l('The action failed. Try again.','L’action a échoué. Réessayez.'));
 const security=['MFA_REQUIRED','ADMIN_REQUIRED'].includes(error);
 return <section className="admin-verification" aria-label={l('Verification','Vérification')}>
  {!verified&&!form&&<>
   <p className="adm-help">{kind==='company'?l('Mark this company as verified once you have checked its identity and activity. Buyers then see “Verified company”.','Marquez cette entreprise comme vérifiée une fois son identité et son activité contrôlées. Les acheteurs voient alors « Entreprise vérifiée ».'):l('Verifying a product publishes it in the public catalogue. Choose its family and record the source you checked.','Vérifier un produit le publie dans le catalogue public. Choisissez sa famille et indiquez la source contrôlée.')}</p>
   <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={()=>kind==='company'?void send({action:'company.verify'}):setForm(true)}>{busy?<LoaderCircle size={16} className="admin-spin"/>:<BadgeCheck size={16}/>}{kind==='company'?l('Mark as verified','Marquer comme vérifiée'):l('Verify and publish to the catalogue','Vérifier et publier au catalogue')}</button>
  </>}
  {form&&<form className="admin-task-form" onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);void send({action:'product.verify',family:String(f.get('family')||''),site:String(f.get('site')||''),roboticsOffer:String(f.get('offer')||''),source:String(f.get('source')||'')})}}>
   <label>{l('Catalogue family','Famille du catalogue')}<select name="family" required defaultValue=""><option value="">{l('Select','Choisir')}</option>{roboticsFamilies.map(f=><option key={f.id} value={f.id}>{l(f.en,f.fr)}</option>)}</select></label>
   <label>{l('Production site','Site de production')}<input name="site" required minLength={3} maxLength={500} defaultValue={defaultSite}/></label>
   <label>{l('Robotics use checked','Usage robotique contrôlé')}<textarea name="offer" rows={3} required minLength={21} maxLength={4000}/></label>
   <label>{l('Source checked (URL)','Source contrôlée (URL)')}<input name="source" type="url" required maxLength={2048} placeholder="https://"/></label>
   <div className="admin-dialog-actions"><button type="button" className="ui-btn ui-btn-secondary" disabled={busy} onClick={()=>setForm(false)}>{l('Cancel','Annuler')}</button><button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>{busy?<LoaderCircle size={16} className="admin-spin"/>:<BadgeCheck size={16}/>}{l('Verify and publish','Vérifier et publier')}</button></div>
  </form>}
  {verified&&!confirmUndo&&<button type="button" className="ui-btn ui-btn-ghost" disabled={busy} onClick={()=>setConfirmUndo(true)}><Undo2 size={15}/>{l('Remove verification','Retirer la vérification')}</button>}
  {verified&&confirmUndo&&<div className="admin-delete-confirm"><p>{kind==='company'?l('The company will be shown as unverified again.','L’entreprise sera de nouveau affichée comme non vérifiée.'):l('The product will be shown as unverified and removed from the public catalogue. Its direct page stays online.','Le produit sera affiché comme non vérifié et retiré du catalogue public. Sa page directe reste en ligne.')}</p><div className="admin-dialog-actions"><button type="button" className="ui-btn ui-btn-secondary" disabled={busy} onClick={()=>setConfirmUndo(false)}>{l('Cancel','Annuler')}</button><button type="button" className="ui-btn ui-btn-danger" disabled={busy} onClick={()=>void send({action:kind+'.unverify'})}>{l('Remove verification','Retirer la vérification')}</button></div></div>}
  {errorText&&<p role="alert" className="admin-form-error">{errorText}{security&&<> <Link href="/compte/securite?next=%2Fadministration">{l('Verify my access','Vérifier mon accès')}</Link></>}</p>}
 </section>;
}
