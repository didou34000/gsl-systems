'use client';
import {useState} from 'react';
import {ExternalLink, Pencil} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog';
import CountryPicker from '@/components/country-picker';
import CountryFlag from '@/components/country-flag';
import LegalFormInput from '@/components/legal-form-input';
import {useLanguage} from './language';
import {getCountryRequirements, type EntityKind} from '@/lib/onboarding/country-requirements';
import type {SupplierProfile} from '@/lib/onboarding/supplier-profile';

export type Identity = Pick<SupplierProfile, 'legalName' | 'tradingName' | 'country' | 'entityKind' | 'legalForm' | 'identifiers' | 'headquarters' | 'publicAddress'>;
export const identityOf = (p: SupplierProfile): Identity => ({legalName: p.legalName, tradingName: p.tradingName, country: p.country, entityKind: p.entityKind, legalForm: p.legalForm, identifiers: p.identifiers, headquarters: p.headquarters, publicAddress: p.publicAddress});

/**
 * High-impact identity fields. The registered name, country and city are published as is
 * (display name, header, public profile); entity type, legal form and registration numbers
 * are what GSL verifies. Any company publication also resets the profile to Unverified.
 */
export type IdentityChange = {key: string; en: string; fr: string; before: string; after: string};
export function identityChanges(before: Identity, after: Identity, countryName: (code: string) => string, entityName: (kind: string) => string): IdentityChange[] {
  const out: IdentityChange[] = [];
  const add = (key: string, en: string, fr: string, a: string, b: string) => {if (a.trim() !== b.trim()) out.push({key, en, fr, before: a.trim(), after: b.trim()});};
  add('legalName', 'Registered name', 'Raison sociale', before.legalName, after.legalName);
  add('country', 'Country of registration', 'Pays d’immatriculation', before.country ? countryName(before.country) : '', after.country ? countryName(after.country) : '');
  add('entityKind', 'Entity type', 'Type d’entité', entityName(before.entityKind), entityName(after.entityKind));
  add('legalForm', 'Local legal form', 'Forme juridique locale', before.legalForm, after.legalForm);
  const ids = (v: Record<string, string>) => Object.entries(v).filter(([, x]) => x.trim()).map(([k, x]) => `${k}:${x.trim()}`).sort().join(' · ');
  if (ids(before.identifiers) !== ids(after.identifiers)) out.push({key: 'identifiers', en: 'Registration identifiers', fr: 'Identifiants d’immatriculation', before: ids(before.identifiers) ? '•••' : '', after: ids(after.identifiers) ? '•••' : ''});
  add('city', 'City', 'Ville', before.headquarters.city, after.headquarters.city);
  return out;
}

export default function SupplierIdentity({profile, published, verified, catalogueCount, disabled, onApply}: {
  profile: SupplierProfile; published: boolean; verified: boolean; catalogueCount: number; disabled: boolean;
  onApply: (identity: Identity) => Promise<boolean>;
}) {
  const {l, language} = useLanguage();
  const [editing, setEditing] = useState(!profile.legalName.trim());
  const [draft, setDraft] = useState<Identity>(() => identityOf(profile));
  const [confirming, setConfirming] = useState<IdentityChange[] | null>(null);
  const [attested, setAttested] = useState(false);
  const [applying, setApplying] = useState(false);
  const [problem, setProblem] = useState('');
  const regions = new Intl.DisplayNames([language], {type: 'region'});
  const countryName = (code: string) => {try {return regions.of(code) || code;} catch {return code;}};
  const entities: [EntityKind, string][] = [['company', l('Company', 'Société')], ['sole_trader', l('Sole trader', 'Entrepreneur individuel')], ['other', l('Other legal entity', 'Autre entité')]];
  const entityName = (kind: string) => entities.find(e => e[0] === kind)?.[1] || kind;
  const current = identityOf(profile);
  const pack = draft.country ? getCountryRequirements(draft.country) : null;
  const set = (values: Partial<Identity>) => {setDraft(d => ({...d, ...values}));setProblem('');};
  function start() {setDraft(identityOf(profile));setEditing(true);setProblem('');}
  function cancel() {setDraft(identityOf(profile));setEditing(!profile.legalName.trim());setProblem('');}
  function submit() {
    if (draft.legalName.trim().length < 2) {setProblem(l('Enter the registered company name.', 'Renseignez la raison sociale.'));return;}
    if (!draft.country) {setProblem(l('Choose the country of registration.', 'Choisissez le pays d’immatriculation.'));return;}
    if (!draft.headquarters.city.trim()) {setProblem(l('Enter the company city.', 'Indiquez la ville de l’entreprise.'));return;}
    const changes = identityChanges(current, draft, countryName, entityName);
    // Filling an empty field for the first time on an unpublished draft needs no confirmation.
    const important = published ? changes : changes.filter(c => c.before);
    if (important.length) {setAttested(false);setConfirming(changes);return;}
    void apply();
  }
  async function apply() {
    setApplying(true);
    const ok = await onApply({...draft, headquarters: {...draft.headquarters, country: draft.country}});
    setApplying(false);
    if (ok) {setConfirming(null);setEditing(false);}
    else setConfirming(null);
  }
  const renaming = confirming?.some(c => c.key === 'legalName');
  const field = (label: string, value: string, onChange: (v: string) => void, options: {required?: boolean; wide?: boolean; hint?: string; max?: number} = {}) =>
    <label className={'sw-field' + (options.wide ? ' sw-wide' : '')}><span>{label}{options.required && ' *'}</span><input value={value} maxLength={options.max || 250} onChange={e => onChange(e.target.value)}/>{options.hint && <small>{options.hint}</small>}</label>;
  return <section className="sw-section si-card">
    <div className="si-head">
      <div><h2>{l('Company identity', 'Identité de l’entreprise')}</h2><p>{l('Use the information shown on your official registry extract.', 'Reprenez les informations de votre extrait officiel.')}</p></div>
      {!editing && <button type="button" className="sw-secondary" disabled={disabled} onClick={start}><Pencil size={15} aria-hidden/>{l('Edit', 'Modifier')}</button>}
    </div>
    {!editing ? <dl className="si-summary">
      <div><dt>{l('Registered name', 'Raison sociale')}</dt><dd>{profile.legalName || '—'}</dd></div>
      {profile.tradingName && <div><dt>{l('Trading name', 'Nom commercial')}</dt><dd>{profile.tradingName}</dd></div>}
      <div><dt>{l('Country of registration', 'Pays d’immatriculation')}</dt><dd>{profile.country ? <><CountryFlag code={profile.country}/> {countryName(profile.country)}</> : '—'}</dd></div>
      <div><dt>{l('Entity type', 'Type d’entité')}</dt><dd>{entityName(profile.entityKind)}{profile.legalForm && ' · ' + profile.legalForm}</dd></div>
      <div><dt>{l('Registered office', 'Siège social')}</dt><dd>{[profile.headquarters.line, profile.headquarters.postalCode, profile.headquarters.city, profile.headquarters.region].filter(Boolean).join(', ') || '—'}</dd></div>
      <div><dt>{l('Registration identifiers', 'Identifiants d’immatriculation')}</dt><dd>{Object.values(profile.identifiers).some(v => v.trim()) ? l('Provided · private', 'Renseignés · privés') : l('Not provided (optional)', 'Non renseignés (facultatif)')}</dd></div>
    </dl> : <>
      {problem && <p className="sw-alert" role="alert">{problem}</p>}
      <div className="sw-fields">
        {field(l('Registered name', 'Raison sociale'), draft.legalName, v => set({legalName: v}), {required: true})}
        {field(l('Trading name', 'Nom commercial'), draft.tradingName, v => set({tradingName: v}))}
        <CountryPicker scope="sourcing" label={l('Country of registration *', 'Pays d’immatriculation *')} value={draft.country} language={language} disabled={disabled}
          onChange={v => set({country: v, identifiers: v === draft.country ? draft.identifiers : {}, headquarters: {...draft.headquarters, country: v}})}/>
        <label className="sw-field"><span>{l('Entity type', 'Type d’entité')}</span><select value={draft.entityKind} onChange={e => set({entityKind: e.target.value as EntityKind, identifiers: e.target.value === draft.entityKind ? draft.identifiers : {}})}>{entities.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label className="sw-field"><span>{l('Local legal form', 'Forme juridique locale')}</span><LegalFormInput country={draft.country} value={draft.legalForm} onChange={v => set({legalForm: v})}/><small>{l('As written on your registry extract. Suggestions follow the country of registration.', 'Telle qu’indiquée sur votre extrait. Les suggestions suivent le pays d’immatriculation.')}</small></label>
        {field(l('City', 'Ville'), draft.headquarters.city, v => set({headquarters: {...draft.headquarters, city: v}}), {required: true})}
        {field(l('Street address', 'Adresse'), draft.headquarters.line, v => set({headquarters: {...draft.headquarters, line: v}}), {wide: true})}
        {field(l('Postal code', 'Code postal'), draft.headquarters.postalCode, v => set({headquarters: {...draft.headquarters, postalCode: v}}))}
        {field(l('Region / province', 'Région / province'), draft.headquarters.region, v => set({headquarters: {...draft.headquarters, region: v}}))}
        <label className="sw-field"><span>{l('Address displayed in profile preview', 'Adresse affichée dans l’aperçu')}</span><select value={draft.publicAddress} onChange={e => set({publicAddress: e.target.value as Identity['publicAddress']})}><option value="city">{l('City and country only', 'Ville et pays uniquement')}</option><option value="exact">{l('Full business address', 'Adresse professionnelle complète')}</option></select></label>
      </div>
      {pack && <div className="si-registration">
        <div className="sw-country-note"><strong><CountryFlag code={draft.country}/> {pack.registryName || l('Country-specific review', 'Examen adapté au pays')}</strong><p>{l(pack.note.en, pack.note.fr)}</p>{pack.registryUrl && <a href={pack.registryUrl} target="_blank" rel="noreferrer">{l('Open official registry', 'Ouvrir le registre officiel')} <ExternalLink size={13}/></a>}<small>{l('Registration numbers stay private. They are used only for verification by GSL.', 'Les numéros d’immatriculation restent privés. Ils servent uniquement à la vérification par GSL.')}</small></div>
        <div className="sw-fields">{pack.fields.filter(f => f.appliesTo.includes(draft.entityKind)).map(f => <div key={f.key}>{field(l(f.label.en, f.label.fr), draft.identifiers[f.key] || '', v => set({identifiers: {...draft.identifiers, [f.key]: v}}))}</div>)}</div>
      </div>}
      <div className="si-actions">
        {profile.legalName.trim() && <button type="button" className="sw-secondary" disabled={applying} onClick={cancel}>{l('Cancel', 'Annuler')}</button>}
        <button type="button" className="button-link" disabled={disabled || applying} onClick={submit}>{applying ? l('Saving…', 'Enregistrement…') : published ? l('Save and publish', 'Enregistrer et publier') : l('Save', 'Enregistrer')}</button>
      </div>
    </>}
    <Dialog open={!!confirming} onOpenChange={open => {if (!open && !applying) setConfirming(null);}}>
      <DialogContent className="sw-dialog">
        <DialogTitle>{renaming ? l('Are you ready to rename your company?', 'Êtes-vous prêt à renommer votre entreprise ?') : l('Confirm the change to your legal information?', 'Confirmer la modification de vos informations légales ?')}</DialogTitle>
        <DialogDescription>{l('Check what will change before applying.', 'Vérifiez ce qui va changer avant d’appliquer.')}</DialogDescription>
        <ul className="si-change-list">{confirming?.map(c => <li key={c.key}><strong>{l(c.en, c.fr)}</strong><span>{c.before ? `${c.before} → ${c.after || '—'}` : c.after}</span></li>)}</ul>
        <ul className="sw-dialog-list">
          {published ? <li>{l('The change is published immediately: public profile, your workspace header and your published products show it right away.', 'La modification est publiée immédiatement : la fiche publique, l’en-tête de votre espace et vos produits publiés l’affichent aussitôt.')}</li>
            : <li>{l('The change is saved in your private draft. It becomes public when you publish your company.', 'La modification est enregistrée dans votre brouillon privé. Elle devient publique lorsque vous publiez votre entreprise.')}</li>}
          {confirming?.some(c => c.key === 'country') && <li>{l('Registration identifiers entered for the previous country are cleared.', 'Les identifiants d’immatriculation saisis pour l’ancien pays sont effacés.')}</li>}
          {published && verified && <li><strong>{l('Your profile goes back to Unverified until GSL reviews it again.', 'Votre fiche repasse en Non vérifiée jusqu’à un nouvel examen par GSL.')}</strong></li>}
          {published && catalogueCount > 0 && <li><strong>{l('Products visible in the catalogue go back to awaiting admission until GSL reviews them again.', 'Les produits visibles au catalogue repassent en attente d’admission jusqu’à un nouvel examen par GSL.')}</strong></li>}
        </ul>
        {published && <label className="sw-checkbox"><input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)}/><span>{l('I am authorised to represent this company. I confirm that these details are accurate to my knowledge and that I have the rights to share the uploaded photos and documents with GSL for review.', 'Je suis habilité à représenter cette entreprise. Je confirme l’exactitude des informations à ma connaissance et dispose des droits pour partager les photos et documents avec GSL pour examen.')}</span></label>}
        <div className="sw-dialog-actions">
          <button type="button" className="sw-secondary" disabled={applying} onClick={() => setConfirming(null)}>{l('Cancel', 'Annuler')}</button>
          <button type="button" className="button-link" disabled={applying || (published && !attested)} onClick={() => void apply()}>{applying ? l('Applying…', 'Application…') : renaming ? l('Rename my company', 'Renommer mon entreprise') : l('Confirm', 'Confirmer')}</button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}
