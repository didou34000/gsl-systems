'use client';
import {useState} from 'react';
import {BadgeCheck,LoaderCircle,Undo2} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';

type Props={kind:'company'|'product';id:string;verified:boolean;onDone:(status:'verified'|'unverified')=>void};

/** Administrator verification of a published company or product. PostgreSQL re-checks role, AAL2 and every field. */
export default function AdminVerification({kind,id,verified,onDone}:Props){
 const {l}=useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmUndo,setConfirmUndo]=useState(false);
 async function send(body:Record<string,string>){
  setBusy(true);setError('');
  try{const response=await fetch('/api/admin/verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...body})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||'UNAVAILABLE');setConfirmUndo(false);onDone(body.action.endsWith('.verify')?'verified':'unverified')}
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
  {!verified&&<>
   <p className="adm-help">{kind==='company'?l('Accepting this company puts it online among the manufacturers with the “Verified company” badge.','Accepter cette entreprise la met en ligne parmi les fabricants, avec le badge « Entreprise vérifiée ».'):l('Accepting a product puts it online in the public catalogue, as its supplier published it.','Accepter un produit le met en ligne dans le catalogue public, tel que le fournisseur l’a publié.')}</p>
   <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={()=>void send({action:kind+'.verify'})}>{busy?<LoaderCircle size={16} className="admin-spin"/>:<BadgeCheck size={16}/>}{kind==='company'?l('Accept and put online','Accepter et mettre en ligne'):l('Accept and put online','Accepter et mettre en ligne')}</button>
  </>}
  {verified&&!confirmUndo&&<button type="button" className="ui-btn ui-btn-ghost" disabled={busy} onClick={()=>setConfirmUndo(true)}><Undo2 size={15}/>{l('Remove verification','Retirer la vérification')}</button>}
  {verified&&confirmUndo&&<div className="admin-delete-confirm"><p>{kind==='company'?l('The company will be shown as unverified again.','L’entreprise sera de nouveau affichée comme non vérifiée.'):l('The product will be shown as unverified and removed from the public catalogue. Its direct page stays online.','Le produit sera affiché comme non vérifié et retiré du catalogue public. Sa page directe reste en ligne.')}</p><div className="admin-dialog-actions"><button type="button" className="ui-btn ui-btn-secondary" disabled={busy} onClick={()=>setConfirmUndo(false)}>{l('Cancel','Annuler')}</button><button type="button" className="ui-btn ui-btn-danger" disabled={busy} onClick={()=>void send({action:kind+'.unverify'})}>{l('Remove verification','Retirer la vérification')}</button></div></div>}
  {errorText&&<p role="alert" className="admin-form-error">{errorText}{security&&<> <Link href="/compte/securite?next=%2Fadministration">{l('Verify my access','Vérifier mon accès')}</Link></>}</p>}
 </section>;
}
