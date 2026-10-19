'use client';
import {useState, type ReactNode} from 'react';
import Image from 'next/image';
import {ArrowLeft, ExternalLink, Eye, Pencil, Plus, Trash2, Upload, Send} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog';
import CountryPicker from '@/components/country-picker';
import CountryFlag from '@/components/country-flag';
import {useLanguage} from './language';
import ProductPhotos from './product-photos';
import type {ProductReview} from '@/lib/products/review';
import {
  composePublishedDescription, formatSpecRow, isRequired, KIND_KEY, legacyCategories, normalizeSpecs, productFamilies, productFamily,
  publishedSpecificationRows, quantityUnitLabels, quantityUnits, specFields, specIssues, type SpecField,
} from '@/lib/products/spec-fields';
import {normalizeProductCategory, productPublicationCategory, productPublicationIssues, productSchema, type SupplierFile, type SupplierProfile} from '@/lib/onboarding/supplier-profile';

type Product = SupplierProfile['products'][number];
export type LiveProduct = {product_id: string; name: string; description: string; category: string; specifications: Record<string, string>; published_at: string};
export type ProductState = 'draft' | 'unpublished' | 'changed' | 'pending' | 'visible' | 'corrections';

const same = (a: unknown, b: unknown) => String(a ?? '').trim() === String(b ?? '').trim();
/**
 * Published rows carry no private product id. Match on the exact name and reference sent by the
 * publication, then on the reference alone, then on the name alone (a renamed product), each row once.
 */
export function matchLiveProducts(products: Product[], live: LiveProduct[]): Map<string, LiveProduct> {
  const out = new Map<string, LiveProduct>();const used = new Set<string>();
  const ref = (p: Product) => (p.reference || '').slice(0, 250);
  const passes: ((p: Product, row: LiveProduct) => boolean)[] = [
    (p, row) => same(row.name, p.name) && same(row.specifications?.reference, ref(p)),
    (p, row) => !!ref(p).trim() && same(row.specifications?.reference, ref(p)),
    (p, row) => !!p.name.trim() && same(row.name, p.name),
  ];
  for (const pass of passes) for (const p of products) {
    if (out.has(p.id)) continue;
    const row = live.find(r => !used.has(r.product_id) && pass(p, r));
    if (row) {out.set(p.id, row);used.add(row.product_id);}
  }
  return out;
}
export function productState(p: Product, row: LiveProduct | undefined, catalogue: string[] | null): {state: ProductState; live?: LiveProduct} {
  if (p.listingStatus === 'draft') return {state: 'draft', live: row};
  if (!row) return {state: 'unpublished'};
  const s = row.specifications || {};
  const minimum = /^\d+(\.\d+)?$/.test(p.moq) && p.unit ? p.moq : '';
  const current = same(row.name, p.name) && row.description === composePublishedDescription(p.description, p.family, normalizeSpecs(p.family, p.specs))
    && row.category === productPublicationCategory(p) && same(s.minimum_quantity, minimum) && same(s.unit, p.unit)
    && same(s.lead_time, p.leadTime) && same(s.materials, p.materials) && same(s.processes, p.processes) && same(s.manufacturing_country, p.origin);
  if (!current) return {state: 'changed', live: row};
  return {state: catalogue?.includes(row.product_id) ? 'visible' : 'pending', live: row};
}

export default function SupplierProducts({profile, files, live, catalogue, companyPublished, locked, busy, onChange, onPublish, onAddFiles, savedAt, reviews=[], reviewAvailable=true, preparePhotos, onPhotoUploading}: {
  reviews?:ProductReview[]; reviewAvailable?:boolean; preparePhotos:()=>Promise<boolean>; onPhotoUploading:(busy:boolean)=>void;
  profile: SupplierProfile; files: SupplierFile[]; live: LiveProduct[]; catalogue: string[] | null; companyPublished: boolean; locked: boolean; busy: boolean; savedAt?: string;
  onChange: (products: Product[]) => void; onPublish: (attested: boolean) => Promise<boolean>; onAddFiles: (product: Product) => void;
}) {
  const {l, language} = useLanguage();
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [attested, setAttested] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const products = profile.products;
  const matches = matchLiveProducts(products, live);
  const states = new Map(products.map(p => {
    const state=productState(p,matches.get(p.id),catalogue),review=reviews.find(r=>r.sourceId===p.id);
    const current=review&&review.payload.description===composePublishedDescription(p.description,p.family,normalizeSpecs(p.family,p.specs))&&['name','reference','family','moq','unit','origin','materials','processes','leadTime'].every(k=>same(p[k as keyof Product],review.payload[k as keyof Product]))&&JSON.stringify(p.photoIds||[])===JSON.stringify(review.payload.photoIds||[])&&JSON.stringify(normalizeSpecs(p.family,p.specs))===JSON.stringify(normalizeSpecs(review.payload.family,review.payload.specs));
    if(p.listingStatus!=='draft'&&current&&review?.status==='pending')return [p.id,{...state,state:'pending' as const}];
    if(p.listingStatus!=='draft'&&current&&review?.status==='changes_requested')return [p.id,{...state,state:'corrections' as const}];
    return [p.id,state];
  }));
  const matched = new Set([...states.values()].map(s => s.live?.product_id).filter(Boolean));
  const orphans = live.filter(row => !matched.has(row.product_id));
  const stateLabel: Record<ProductState, string> = {
    draft: l('Private draft', 'Brouillon privé'),
    unpublished: l('Ready to submit', 'À envoyer pour validation'),
    changed: l('Changes to submit', 'Modifications à envoyer'),
    pending: l('Awaiting administrator approval', 'En attente de validation admin'),
    corrections:l('Corrections requested','Corrections demandées'),
    visible: l('Visible in the catalogue', 'Visible au catalogue'),
  };
  const stateHint: Record<ProductState, string> = {
    draft: l('Only you can see it.', 'Vous seul le voyez.'),
    unpublished: l('Private until administrator approval.', 'Privé jusqu’à la validation par un administrateur.'),
    changed: l('New products and photos stay private until approved by an administrator. The last approved version stays online while changes are reviewed.','Les nouveaux produits et leurs photos restent privés jusqu’à la validation admin. La dernière version validée reste en ligne pendant l’examen des modifications.'),
    pending: l('An administrator must approve the submitted version.', 'Un administrateur doit valider la version envoyée.'),
    corrections:l('Read the administrator feedback, then submit the corrected product.','Consultez le retour de l’administrateur, puis renvoyez le produit corrigé.'),
    visible: l('Buyers can find it in the catalogue.', 'Les acheteurs le trouvent dans le catalogue.'),
  };
  const issuesOf = (p: Product) => productPublicationIssues({...profile, attestation: true, products: [{...p, listingStatus: 'publish'}]}).filter(i => i.path.startsWith('products.'));
  const familyLabel = (p: Product) => {const f = productFamily(p.family); if (!f) return l('To choose', 'À choisir'); const k = f.fields.find(x => x.key === KIND_KEY)?.options?.find(o => o.value === p.specs?.[KIND_KEY]); return k ? l(k.en, k.fr) : l(f.en, f.fr);};
  const unitLabel = (unit: string) => quantityUnitLabels[unit] ? l(quantityUnitLabels[unit].en, quantityUnitLabels[unit].fr) : unit;
  const date = (value?: string) => value ? new Date(value).toLocaleDateString(language, {day: 'numeric', month: 'short', year: 'numeric'}) : '—';
  function patch(id: string, values: Partial<Product>) {
    onChange(products.map(p => p.id === id ? {...p, ...values, updatedAt: new Date().toISOString()} : p));
  }
  function add() {
    const product = productSchema.parse({id: crypto.randomUUID(), origin: profile.country, listingStatus: 'publish', unit: 'pcs', updatedAt: new Date().toISOString()});
    onChange([...products, product]);setEditing(product.id);setShowErrors(false);
  }
  function remove(p: Product) {
    const published = states.get(p.id)?.live;
    if (!window.confirm(published ? l('Delete this product? It stays online until your next publication, then it is withdrawn.', 'Supprimer ce produit ? Il reste en ligne jusqu’à votre prochaine publication, puis il est retiré.') : l('Delete this product?', 'Supprimer ce produit ?'))) return;
    onChange(products.filter(v => v.id !== p.id));if (editing === p.id) setEditing(null);
  }
  const toPublish = products.filter(p => p.listingStatus !== 'draft');
  const blocking = toPublish.filter(p => issuesOf(p).length);
  const visibleCount = [...states.values()].filter(s => s.state === 'visible').length;
  const publishedCount = live.length;
  async function confirmPublish() {
    const ok = await onPublish(attested);
    if (ok) {setPublishing(false);setAttested(false);}
  }
  const current = products.find(p => p.id === editing);
  if (current) return <ProductEditor product={current} files={files} showErrors={showErrors} issues={issuesOf(current)} state={states.get(current.id)!} stateLabel={stateLabel} locked={locked||busy} preparePhotos={preparePhotos} onPhotoUploading={onPhotoUploading} feedback={reviews.find(r=>r.sourceId===current.id)?.feedback||''}
    onPatch={values => patch(current.id, values)} onBack={() => {setEditing(null);window.scrollTo({top: 0, behavior: 'smooth'});}} onPreview={() => setPreview(current.id)} onAddFiles={() => onAddFiles(current)}
    previewNode={preview === current.id ? <ProductPreview product={current} live={states.get(current.id)?.live} onClose={() => setPreview(null)}/> : null}/>;
  const previewed = products.find(p => p.id === preview);
  return <section className="sw-section sp-dashboard">
    <div className="sp-dashboard-head">
      <div>
        <h2>{l('Your products', 'Vos produits')}</h2>
        <p>{products.length ? l('{count} product(s) · {published} published · {visible} visible in the catalogue', '{count} produit(s) · {published} publié(s) · {visible} visible(s) au catalogue').replace('{count}', String(products.length)).replace('{published}', String(publishedCount)).replace('{visible}', String(visibleCount)) : l('Add a product, complete the required fields, then submit it for administrator approval.','Ajoutez un produit, complétez les champs obligatoires, puis envoyez-le pour validation par un administrateur.')}</p>
      </div>
      <div className="sp-dashboard-actions">
        <button type="button" className="sw-secondary" disabled={locked || products.length >= 30} onClick={add}><Plus size={16} aria-hidden/>{l('Add a product', 'Ajouter un produit')}</button>
        {!locked && <button type="button" className="button-link" disabled={busy || !reviewAvailable || !companyPublished || !toPublish.length} onClick={() => {setShowErrors(true);setPublishing(true);}}><Send size={16} aria-hidden/>{l('Submit for approval', 'Envoyer pour validation')}</button>}
      </div>
    </div>
    {!reviewAvailable && <p className="sw-alert" role="status">{l('Product submission is temporarily unavailable. You can still edit and save your information.','L’envoi des produits est temporairement indisponible. Vous pouvez continuer à modifier et enregistrer vos informations.')}</p>}
    {!companyPublished && <p className="sp-note">{l('Publish your company before listing its products.', 'Publiez votre entreprise avant de mettre ses produits en ligne.')}</p>}
    <p className="sp-note">{l('New products and photos stay private until approved by an administrator. The last approved version stays online while changes are reviewed.','Les nouveaux produits et photos restent privés jusqu’à leur validation par un administrateur. La dernière version approuvée reste en ligne pendant l’examen des modifications.')}</p>
    {products.length > 0 && <div className="sp-table-wrap"><table className="sp-table">
      <thead><tr>
        <th scope="col">{l('Product', 'Produit')}</th><th scope="col">{l('Type', 'Type')}</th><th scope="col">{l('Minimum order', 'Quantité minimale')}</th>
        <th scope="col">{l('Status', 'Statut')}</th><th scope="col">{l('Last updated', 'Dernière mise à jour')}</th><th scope="col"><span className="ob-sr">{l('Actions', 'Actions')}</span></th>
      </tr></thead>
      <tbody>{products.map(p => {
        const s = states.get(p.id)!;const missing = p.listingStatus !== 'draft' && issuesOf(p).length > 0;
        return <tr key={p.id}>
          <td><button type="button" className="sp-name" onClick={() => {setEditing(p.id);setShowErrors(false);}}>{p.name || l('Untitled product', 'Produit sans titre')}</button>{p.reference && <small>{p.reference}</small>}{missing && <small className="sp-missing">{l('Information to complete', 'Informations à compléter')}</small>}</td>
          <td>{familyLabel(p)}</td>
          <td>{p.moq ? `${p.moq.replace('.', language === 'fr' ? ',' : '.')} ${unitLabel(p.unit)}` : <span className="sp-missing">{l('To specify', 'À préciser')}</span>}</td>
          <td><span className={'sp-state sp-state-' + s.state}>{stateLabel[s.state]}</span><small>{stateHint[s.state]}</small></td>
          <td>{date(p.updatedAt || savedAt)}{s.live && <small>{l('Published on ', 'Publié le ')}{date(s.live.published_at)}</small>}</td>
          <td><div className="sp-row-actions">
            <button type="button" onClick={() => {setEditing(p.id);setShowErrors(false);}} aria-label={l('Edit ', 'Modifier ') + (p.name || '')}><Pencil size={15} aria-hidden/>{l('Edit', 'Modifier')}</button>
            {s.live && s.state !== 'changed' && s.state !== 'draft' ? <a href={'/produits/' + s.live.product_id} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden/>{l('Product page', 'Page produit')}</a>
              : <button type="button" onClick={() => setPreview(p.id)}><Eye size={15} aria-hidden/>{l('Preview', 'Aperçu')}</button>}
            {!locked && <button type="button" onClick={() => remove(p)} aria-label={l('Delete ', 'Supprimer ') + (p.name || '')}><Trash2 size={15} aria-hidden/></button>}
          </div></td>
        </tr>;
      })}</tbody>
    </table></div>}
    {orphans.length > 0 && <div className="sp-note"><strong>{l('Published but no longer in your list', 'Publiés mais absents de votre liste')}</strong><p>{l('These products stay online until your next publication, then they are withdrawn.', 'Ces produits restent en ligne jusqu’à votre prochaine publication, puis ils sont retirés.')}</p><ul>{orphans.map(row => <li key={row.product_id}><a href={'/produits/' + row.product_id} target="_blank" rel="noreferrer">{row.name} <ExternalLink size={13} aria-hidden/></a></li>)}</ul></div>}
    {previewed && <ProductPreview product={previewed} live={states.get(previewed.id)?.live} onClose={() => setPreview(null)}/>}
    <Dialog open={publishing} onOpenChange={open => {if (!open) setPublishing(false);}}>
      <DialogContent className="sw-dialog">
        <DialogTitle>{l('Submit products for approval?', 'Envoyer les produits pour validation ?')}</DialogTitle>
        <DialogDescription>{l('This sends a private request to GSL administrators. Nothing new goes online before their approval.','Cet envoi crée une demande privée auprès des administrateurs GSL. Aucune nouveauté n’est mise en ligne avant leur validation.')}</DialogDescription>
        <ul className="sw-dialog-list">
          <li>{l('{count} product(s) submitted for approval','{count} produit(s) envoyé(s) pour validation').replace('{count}', String(toPublish.length))}</li>
          {products.length - toPublish.length > 0 && <li>{l('{count} private draft(s) not published', '{count} brouillon(s) privé(s) non publié(s)').replace('{count}', String(products.length - toPublish.length))}</li>}
          {(orphans.length > 0 || products.some(p => p.listingStatus === 'draft' && states.get(p.id)?.live)) && <li>{l('Products removed from the list or set back to draft are withdrawn.', 'Les produits retirés de la liste ou repassés en brouillon sont retirés du site.')}</li>}
          <li>{l('An administrator checks the product and photos before approving publication.','Un administrateur examine le produit et ses photos avant d’autoriser la publication.')}</li>
        </ul>
        {blocking.length > 0 && <div className="sw-alert" role="alert"><strong>{l('Complete these products first, or keep them as private drafts:', 'Complétez d’abord ces produits, ou gardez-les en brouillon privé :')}</strong><ul>{blocking.map(p => <li key={p.id}><button type="button" onClick={() => {setPublishing(false);setEditing(p.id);setShowErrors(true);}}>{p.name || l('Untitled product', 'Produit sans titre')} — {l(issuesOf(p)[0].en, issuesOf(p)[0].fr)}</button></li>)}</ul></div>}
        <label className="sw-checkbox"><input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)}/><span>{l('I am authorised to publish these products and confirm that the information is accurate to my knowledge.', 'Je suis habilité à publier ces produits et confirme l’exactitude des informations à ma connaissance.')}</span></label>
        <div className="sw-dialog-actions">
          <button type="button" className="sw-secondary" onClick={() => setPublishing(false)}>{l('Cancel', 'Annuler')}</button>
          <button type="button" className="button-link" disabled={busy || !reviewAvailable || !attested || blocking.length > 0} onClick={() => void confirmPublish()}>{busy ? l('Sending…', 'Envoi…') : l('Submit for approval', 'Envoyer pour validation')}</button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}

function ProductEditor({product: p, files, issues, showErrors, state, stateLabel, locked, onPatch, onBack, onPreview, onAddFiles, previewNode, preparePhotos, onPhotoUploading, feedback}: {
  preparePhotos:()=>Promise<boolean>;onPhotoUploading:(busy:boolean)=>void;feedback:string;
  product: Product; files: SupplierFile[]; issues: {path: string; en: string; fr: string}[]; showErrors: boolean; state: {state: ProductState; live?: LiveProduct}; stateLabel: Record<ProductState, string>; locked: boolean;
  onPatch: (values: Partial<Product>) => void; onBack: () => void; onPreview: () => void; onAddFiles: () => void; previewNode: ReactNode;
}) {
  const {l, language} = useLanguage();
  const family = productFamily(p.family);
  const kindValue = p.specs?.[KIND_KEY] || '';
  const technical = specIssues(p.family, p.specs);
  const invalid = new Set(showErrors ? technical.map(x => x.key) : []);
  const needs = (path: string) => showErrors && issues.some(i => i.path === path || i.path.startsWith(path + '.'));
  const setSpec = (key: string, value: string) => onPatch({specs: {...p.specs, [key]: value}});
  function chooseFamily(id: string) {
    const own = Object.entries(p.specs || {}).filter(([k, v]) => k !== 'compatibility' && v);
    if (own.length && id !== p.family && !window.confirm(l('Changing the product type clears its technical specifications. Continue?', 'Changer le type de produit efface ses caractéristiques techniques. Continuer ?'))) return;
    const next = productFamily(id);
    onPatch({family: id, specs: p.specs?.compatibility ? {compatibility: p.specs.compatibility} : {}, category: next && next.id !== 'autre' ? next.category : normalizeProductCategory(p.category)});
  }
  function input(field: SpecField) {
    const value = p.specs?.[field.key] || '';
    const label = <span>{l(field.en, field.fr)}{isRequired(field, kindValue) && ' *'}{field.unit && <em className="sp-unit"> ({(language === 'fr' && field.unitFr) || field.unit})</em>}</span>;
    const listId = field.suggestions ? `sp-${p.id}-${field.key}` : undefined;
    return <label key={field.key} className={'sw-field' + (field.key === 'compatibility' ? ' sw-wide' : '') + (invalid.has(field.key) ? ' sp-invalid' : '')}>
      {label}
      {field.type === 'select'
        ? <select value={value} onChange={e => setSpec(field.key, e.target.value)}><option value="">{l('Select', 'Choisir')}</option>{field.options!.map(o => <option key={o.value} value={o.value}>{l(o.en, o.fr)}</option>)}</select>
        : <input value={value} inputMode={field.type === 'number' ? 'decimal' : undefined} maxLength={field.max || (field.type === 'number' ? 20 : 120)} list={listId} placeholder={field.placeholder} aria-invalid={invalid.has(field.key) || undefined} onChange={e => setSpec(field.key, e.target.value)}/>}
      {listId && <datalist id={listId}>{field.suggestions!.map(s => <option key={s} value={s}/>)}</datalist>}
      {isRequired(field,kindValue)&&required}
      {field.hintEn && <small>{l(field.hintEn, field.hintFr || field.hintEn)}</small>}
    </label>;
  }
  const fields = family ? specFields(family.id, kindValue) : [];
  const kindField = fields.find(f => f.key === KIND_KEY);
  const required=<small className="sp-required">{l('Required for approval','Obligatoire pour la validation')}</small>;
  return <section className="sw-section sp-editor">
    <div className="sp-editor-head">
      <button type="button" className="sw-secondary" onClick={onBack}><ArrowLeft size={16} aria-hidden/>{l('Back to my products', 'Retour à mes produits')}</button>
      <span className={'sp-state sp-state-' + state.state}>{stateLabel[state.state]}</span>
    </div>
    <h2>{p.name || l('New product', 'Nouveau produit')}</h2>
    <p>{l('Red notes identify the required information. Your entries are saved automatically as a private draft.','Les indications rouges signalent les informations obligatoires. Votre saisie est enregistrée automatiquement en brouillon privé.')}</p>
    {feedback&&<p className="sp-note" role="status"><strong>{l('Administrator feedback','Retour de l’administrateur')}</strong> : {feedback}</p>}
    {showErrors && issues.length > 0 && <div className="sw-alert" role="alert"><ul>{issues.map(i => <li key={i.path}>{l(i.en, i.fr)}</li>)}</ul></div>}
    <fieldset className="sw-fieldset" disabled={locked}>
      <div className="sp-block">
        <h3>{l('Essentials', 'L’essentiel')}</h3>
        <div className="sw-fields">
          <label className={'sw-field' + (needs('products.0') && !p.name.trim() ? ' sp-invalid' : '')}><span>{l('Product name', 'Nom du produit')} *</span><input value={p.name} maxLength={250} onChange={e => onPatch({name: e.target.value})}/>{required}</label>
          <label className="sw-field"><span>{l('Exact reference / model', 'Référence exacte / modèle')}</span><input value={p.reference} maxLength={250} onChange={e => onPatch({reference: e.target.value})}/></label>
          <label className={'sw-field' + (needs('products.0.family') ? ' sp-invalid' : '')}><span>{l('Product type', 'Type de produit')} *</span>
            <select value={p.family} onChange={e => chooseFamily(e.target.value)}><option value="">{l('Select', 'Choisir')}</option>{productFamilies.map(f => <option key={f.id} value={f.id}>{l(f.en, f.fr)}</option>)}</select>
            <small>{l('Determines the technical specifications requested below.', 'Détermine les caractéristiques techniques demandées plus bas.')}</small>{required}</label>
          {kindField && input(kindField)}
          {family?.id === 'autre' && <label className="sw-field"><span>{l('Category', 'Catégorie')} *</span><select value={normalizeProductCategory(p.category)} onChange={e => onPatch({category: e.target.value})}><option value="">{l('Select', 'Choisir')}</option>{legacyCategories.map(c => <option key={c.value} value={c.value}>{l(c.en, c.fr)}</option>)}</select>{required}</label>}
          <div><CountryPicker scope="sourcing" label={l('Country of manufacture', 'Pays de fabrication') + ' *'} value={p.origin} onChange={v => onPatch({origin: v})} language={language} disabled={locked}/>{required}</div>
          <label className={'sw-field sw-wide' + (needs('products.0') && p.description.trim().length < 30 ? ' sp-invalid' : '')}><span>{l('Description & intended use', 'Description et usage prévu')} *</span>
            <textarea rows={4} maxLength={5000} value={p.description} onChange={e => onPatch({description: e.target.value})}/>
            <small>{l('At least 30 characters. Include dimensions, applications and customisation.', 'Au moins 30 caractères. Indiquez dimensions, applications et personnalisation.')} {p.description.trim().length}/30</small>{required}</label>
        </div>
      </div>
      <div className="sp-block">
        <h3>{l('Ordering', 'Commande')}</h3>
        <div className="sw-fields">
          <div className={'sp-moq' + (needs('products.0.moq') ? ' sp-invalid' : '')}>
            <label className="sw-field"><span>{l('Minimum order quantity', 'Quantité minimale de commande')} *</span><input inputMode="decimal" maxLength={30} value={p.moq} placeholder="100" onChange={e => onPatch({moq: e.target.value.replace(/[\s  ]/g, '').replace(',', '.')})}/>{required}</label>
            <label className="sw-field"><span>{l('Unit', 'Unité')} *</span><select value={(quantityUnits as readonly string[]).includes(p.unit) ? p.unit : ''} onChange={e => onPatch({unit: e.target.value})}><option value="">{l('Select', 'Choisir')}</option>{quantityUnits.map(u => <option key={u} value={u}>{l(quantityUnitLabels[u].en, quantityUnitLabels[u].fr)}</option>)}</select>{required}</label>
          </div>
          <label className="sw-field"><span>{l('Lead time & assumptions', 'Délai et hypothèses')}</span><input value={p.leadTime} maxLength={250} placeholder={l('6 weeks after sample approval', '6 semaines après validation de l’échantillon')} onChange={e => onPatch({leadTime: e.target.value})}/></label>
        </div>
      </div>
      <div className="sp-block">
        <h3>{l('Technical specifications', 'Caractéristiques techniques')}</h3>
        {!family ? <p className="sp-note">{l('Choose the product type to display the relevant specifications.', 'Choisissez le type de produit pour afficher les caractéristiques adaptées.')}</p>
          : kindField && !kindValue ? <p className="sp-note">{l('Choose the type to display the relevant specifications.', 'Choisissez le type pour afficher les caractéristiques adaptées.')}</p> : null}
        {family && <div className="sw-fields">{fields.filter(f => f.key !== KIND_KEY && (!kindField || kindValue || f.key === 'compatibility')).map(input)}</div>}
        {family && <small className="sp-hint">{l('Enter numbers only: the unit is shown next to each label. Use a dot or a comma for decimals.', 'Saisissez uniquement des nombres : l’unité figure à côté de chaque libellé. Utilisez un point ou une virgule pour les décimales.')}</small>}
      </div>
      <div className="sp-block">
        <h3>{l('Manufacturing', 'Fabrication')}</h3>
        <div className="sw-fields">
          <label className="sw-field"><span>{l('Materials', 'Matières')}</span><input value={p.materials} maxLength={250} onChange={e => onPatch({materials: e.target.value})}/></label>
          <label className="sw-field"><span>{l('Processes', 'Procédés')}</span><input value={p.processes} maxLength={250} onChange={e => onPatch({processes: e.target.value})}/></label>
        </div>
      </div>
      <details className="sp-block">
        <summary>{l('CE marking and standards (optional)', 'Marquage CE et normes (facultatif)')}</summary>
        <div className="sw-fields">
          <label className="sw-field"><span>{l('CE marking assessment', 'Situation du marquage CE')}</span><select value={p.ce} onChange={e => onPatch({ce: e.target.value as Product['ce']})}><option value="unknown">{l('To be assessed', 'À déterminer')}</option><option value="required">{l('Applicable to this product', 'Applicable à ce produit')}</option><option value="not_applicable">{l('Not applicable, with explanation', 'Non applicable, avec explication')}</option></select></label>
          {p.ce === 'not_applicable' && <label className="sw-field"><span>{l('Reason', 'Justification')}</span><textarea rows={3} maxLength={5000} value={p.ceReason} onChange={e => onPatch({ceReason: e.target.value})}/></label>}
          {p.ce === 'required' && <><label className="sw-field"><span>{l('Applicable EU legislation', 'Textes européens applicables')}</span><input value={p.legislation} maxLength={250} onChange={e => onPatch({legislation: e.target.value})}/><small>{l('Use the exact references in your declaration.', 'Reprenez les références exactes de votre déclaration.')}</small></label>
            <label className="sw-field"><span>{l('Declaration of conformity / performance', 'Déclaration de conformité / de performance')}</span><select value={p.documentId} onChange={e => onPatch({documentId: e.target.value})}><option value="">{l('Select', 'Choisir')}</option>{files.filter(f => f.kind === 'technical').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label></>}
          <label className="sw-field sw-wide"><span>{l('Standards & editions used', 'Normes et éditions appliquées')}</span><input value={p.standards} maxLength={250} onChange={e => onPatch({standards: e.target.value})}/></label>
        </div>
      </details>
      <div className="sp-block">
        <h3>{l('Photos and documents', 'Photos et documents')}</h3>
        <ProductPhotos product={p.id} value={p.photoIds||[]} disabled={locked} prepare={preparePhotos} onChange={photoIds=>onPatch({photoIds})} onUploading={onPhotoUploading}/>
        <button type="button" className="sw-secondary" onClick={onAddFiles}><Upload size={16} aria-hidden/>{l('Supporting documents','Justificatifs')}</button>
      </div>
      <div className="sp-block">
        <h3>{l('Product visibility', 'Visibilité du produit')}</h3>
        <div className="sp-visibility">
          <label className="sw-checkbox"><input type="radio" name={'visibility-' + p.id} checked={p.listingStatus !== 'draft'} onChange={() => onPatch({listingStatus: 'publish'})}/><span>{l('Include in the approval request', 'Inclure dans la demande de validation')}</span></label>
          <label className="sw-checkbox"><input type="radio" name={'visibility-' + p.id} checked={p.listingStatus === 'draft'} onChange={() => onPatch({listingStatus: 'draft'})}/><span>{l('Private draft — complete later', 'Brouillon privé — à compléter plus tard')}</span></label>
        </div>
      </div>
    </fieldset>
    <div className="sp-editor-foot">
      <button type="button" className="sw-secondary" onClick={onBack}><ArrowLeft size={16} aria-hidden/>{l('Back to my products', 'Retour à mes produits')}</button>
      <button type="button" className="sw-secondary" onClick={onPreview}><Eye size={16} aria-hidden/>{l('Preview the product page', 'Aperçu de la page produit')}</button>
      {state.live && <a className="sw-secondary" href={'/produits/' + state.live.product_id} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden/>{l('Published page', 'Page publiée')}</a>}
    </div>
    {previewNode}
  </section>;
}

/** Private preview built with the same labelled rows as the public product page. */
export function ProductPreview({product: p, live, onClose}: {product: Product; live?: LiveProduct; onClose: () => void}) {
  const {l, language} = useLanguage();
  const specs = normalizeSpecs(p.family, p.specs);
  const view = publishedSpecificationRows({
    category: productPublicationCategory(p),
    description: composePublishedDescription(p.description, p.family, specs),
    specifications: {reference: p.reference, minimum_quantity: /^\d+(\.\d+)?$/.test(p.moq) && p.unit ? p.moq : '', unit: p.unit, lead_time: p.leadTime, materials: p.materials, processes: p.processes, manufacturing_country: p.origin},
  });
  const countries = new Intl.DisplayNames([language], {type: 'region'});
  return <Dialog open onOpenChange={open => {if (!open) onClose();}}>
    <DialogContent className="sw-dialog sp-preview">
      <DialogTitle>{p.name || l('Untitled product', 'Produit sans titre')}</DialogTitle>
      <DialogDescription>{l('Private preview of the product page. Nothing here is published.', 'Aperçu privé de la page produit. Rien n’est publié ici.')}{live && <> <a href={'/produits/' + live.product_id} target="_blank" rel="noreferrer">{l('Open the published page', 'Ouvrir la page publiée')} <ExternalLink size={13} aria-hidden/></a></>}</DialogDescription>
      <div className="sp-photo-grid">{(p.photoIds||[]).map((id,i)=><Image key={id} unoptimized width={400} height={300} src={'/api/product-images?id='+id} alt={l('Product photo','Photo du produit')+' '+(i+1)}/>)}</div>
      <p className="sp-preview-meta">{view.family ? l(view.family.en, view.family.fr) : l('Product type to choose', 'Type de produit à choisir')}{p.origin && <> · <CountryFlag code={p.origin}/> {countries.of(p.origin)}</>}</p>
      <p className="sw-multiline">{view.description || l('Description to write.', 'Description à rédiger.')}</p>
      {view.rows.length > 0 && <><h3>{l('Technical specifications', 'Caractéristiques techniques')}</h3><dl className="sp-spec-list">{view.rows.map(r => <div key={r.key}><dt>{l(r.en, r.fr)}</dt><dd>{formatSpecRow(r, language)}</dd></div>)}</dl></>}
      {view.commercial.length > 0 && <><h3>{l('Ordering', 'Commande')}</h3><dl className="sp-spec-list">{view.commercial.map(r => <div key={r.key}><dt>{l(r.en, r.fr)}</dt><dd>{formatSpecRow(r, language)}</dd></div>)}</dl></>}
      <small>{l('Declared by the supplier, not verified by GSL.', 'Déclaré par le fournisseur, non vérifié par GSL.')}</small>
    </DialogContent>
  </Dialog>;
}
