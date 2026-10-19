'use client';
import {useEffect,useState} from 'react';
import Link from '@/components/site-link';
import {roboticsFamilies as componentFamilies} from '@/lib/robotics';
import type {ProductReview} from '@/lib/products/review';
import {stripSpecificationBlock} from '@/lib/products/spec-fields';
import {useLanguage} from './language';
import {ProductPreview} from './supplier-products';

async function fetchReviews(){const r=await fetch('/api/admin/product-reviews',{cache:'no-store'});const d=await r.json() as {reviews?:ProductReview[];error?:string};if(!r.ok)throw Error(d.error);return d.reviews||[]}
export default function AdminProductReviews(){
 const {l}=useLanguage();const [reviews,setReviews]=useState<ProductReview[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[preview,setPreview]=useState<ProductReview|null>(null);
 async function load(){setReviews(await fetchReviews());setError('')}
 useEffect(()=>{let active=true;fetchReviews().then(rows=>{if(active)setReviews(rows)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 async function decide(review:ProductReview,form:HTMLFormElement,decision:'approve'|'changes_requested'){
  const feedback=form.elements.namedItem('feedback') as HTMLTextAreaElement;if(!feedback.reportValidity())return;
  const fields=new FormData(form);setBusy(true);setError('');setNotice('');
  try{const response=await fetch('/api/admin/product-reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:review.id,revision:review.revision,decision,feedback:String(fields.get('feedback')||''),...(decision==='approve'?{family:String(fields.get('family')||''),site:String(fields.get('site')||''),roboticsOffer:String(fields.get('offer')||''),source:String(fields.get('source')||'')}:{})})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error);await load();setNotice(decision==='approve'?l('Product and photos approved and published.','Produit et photos validés et publiés.'):l('Corrections requested. The supplier can read your feedback.','Corrections demandées. Le fournisseur peut lire votre retour.'))}catch(e){setError(e instanceof Error?e.message:'UNAVAILABLE')}finally{setBusy(false)}
 }
 const accessError=['LOGIN_REQUIRED','ADMIN_REQUIRED','PERMISSION_REQUIRED','MFA_REQUIRED'].includes(error);
 return <main className="product-review-page"><div className="sp-dashboard-head"><div><h1>{l('Product approvals','Validation des produits')}</h1><p>{l('Review each submitted product and its photos before publication.','Examinez chaque produit soumis et ses photos avant sa publication.')}</p></div><button type="button" className="sw-secondary" disabled={busy||loading} onClick={()=>void load().catch(e=>setError(e.message))}>{l('Refresh','Actualiser')}</button></div>
 {loading&&<p role="status">{l('Loading…','Chargement…')}</p>}
 {error&&<div className="sw-alert" role="alert">{accessError?l('An active administrator account and two-factor verification are required.','Un compte administrateur actif et une vérification à deux facteurs sont nécessaires.'):error==='CONFLICT'?l('This request changed. Refresh before deciding.','Cette demande a changé. Actualisez avant de décider.'):l('The request could not be processed. Check the fields and try again.','La demande n’a pas pu être traitée. Vérifiez les champs et réessayez.')}{accessError&&<p><Link href="/compte/securite?next=%2Fadministration%2Fvalidation-produits">{l('Verify my access','Vérifier mon accès')}</Link></p>}</div>}
 {notice&&<p className="sw-success" role="status">{notice}</p>}
 {!loading&&!error&&!reviews.length&&<p>{l('No product awaiting approval.','Aucun produit en attente de validation.')}</p>}
 {reviews.map(review=><article key={review.id} className="sw-section product-review-card"><h2>{review.payload.name}</h2><p>{review.companyName} · {review.payload.reference}</p><p className="sw-multiline">{stripSpecificationBlock(review.payload.description)}</p><button type="button" className="sw-secondary" onClick={()=>setPreview(review)}>{l('Preview the product page','Aperçu de la page produit')}</button>
 <form onSubmit={event=>{event.preventDefault();void decide(review,event.currentTarget,'approve')}}><fieldset className="sw-fieldset" disabled={busy}><div className="sw-fields">
 <label className="sw-field"><span>{l('Catalogue family','Famille du catalogue')} *</span><select name="family" required defaultValue=""><option value="">{l('Select','Choisir')}</option>{componentFamilies.map(f=><option key={f.id} value={f.id}>{l(f.en,f.fr)}</option>)}</select></label>
 <label className="sw-field"><span>{l('Production site','Site de production')} *</span><input name="site" required minLength={3} maxLength={500} defaultValue={review.companyCity||''}/></label>
 <label className="sw-field sw-wide"><span>{l('Robotics application reviewed','Usage robotique examiné')} *</span><textarea name="offer" required minLength={21} maxLength={4000}/></label>
 <label className="sw-field sw-wide"><span>{l('Reviewed source URL','URL de la source examinée')} *</span><input name="source" type="url" required maxLength={2048}/></label>
 <label className="sw-field sw-wide"><span>{l('Feedback visible to the supplier','Retour visible du fournisseur')} *</span><textarea name="feedback" required minLength={5} maxLength={2000}/></label>
 </div><div className="sp-editor-foot"><button type="submit" className="button-link">{l('Approve and publish','Valider et publier')}</button><button type="button" className="sw-secondary" onClick={event=>void decide(review,event.currentTarget.form!,'changes_requested')}>{l('Request corrections','Demander des corrections')}</button></div></fieldset></form></article>)}
 {preview&&<ProductPreview product={{...preview.payload,description:stripSpecificationBlock(preview.payload.description)}} onClose={()=>setPreview(null)}/>}
 </main>;
}
