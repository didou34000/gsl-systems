'use client';
import {ExternalLink} from 'lucide-react';
import CountryPicker from '@/components/country-picker';
import CountryFlag from '@/components/country-flag';
import LegalFormInput from '@/components/legal-form-input';
import {useLanguage} from './language';
import {getCountryRequirements, type EntityKind} from '@/lib/onboarding/country-requirements';
import type {SupplierProfile} from '@/lib/onboarding/supplier-profile';

export type Identity = Pick<SupplierProfile, 'legalName' | 'tradingName' | 'country' | 'entityKind' | 'legalForm' | 'identifiers' | 'headquarters' | 'publicAddress'>;

/** Controlled fields: identity and the rest of the profile share one save action. */
export default function SupplierIdentity({profile: draft, disabled, onChange: set}: {
  profile: SupplierProfile; disabled: boolean; onChange: (identity: Partial<Identity>) => void;
}) {
  const {l, language} = useLanguage();
  const pack = draft.country ? getCountryRequirements(draft.country) : null;
  const entities: [EntityKind, string][] = [['company', l('Company', 'Société')], ['sole_trader', l('Sole trader', 'Entrepreneur individuel')], ['other', l('Other legal entity', 'Autre entité')]];
  const field = (label: string, value: string, onChange: (v: string) => void, options: {required?: boolean; wide?: boolean; hint?: string; max?: number} = {}) =>
    <label className={'sw-field' + (options.wide ? ' sw-wide' : '')}><span>{label}{options.required && ' *'}</span><input value={value} maxLength={options.max || 250} onChange={e => onChange(e.target.value)}/>{options.hint && <small>{options.hint}</small>}</label>;
  return <section className="sw-section si-card">
    <div className="si-head"><div><h2>{l('Company identity', 'Identité de l’entreprise')}</h2><p>{l('Use the information shown on your official registry extract.', 'Reprenez les informations de votre extrait officiel.')}</p></div></div>
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
  </section>;
}
