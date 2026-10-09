'use client';

import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {ArrowLeft, ArrowUpRight, Building2, Check, ChevronRight, CircleAlert, ExternalLink, Eye, EyeOff, FileCheck2, Globe2, LoaderCircle, Mail, Package, Pencil, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, X} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage, type Language} from './language';
import {adminLanguages} from '@/lib/admin/translations';
import type {CatalogueCompany, CatalogueMutation, CatalogueProduct, CatalogueSnapshot} from '@/lib/admin/catalogue-types';
import {companyResearch, productResearch, researchCategories, safeSourceUrl, type CompanyResearch, type ProductResearch, type ResearchSource} from '@/lib/catalogue-research';
import {catalogueMutationSchema, catalogueSnapshotSchema} from './api/admin/catalogue/validation';

type Translate = (en: string, fr: string) => string;
type SpecRow = {key: string; value: string};
type CompanyDraft = {kind: 'company'; company: CatalogueCompany; research: CompanyResearch};
type ProductDraft = {
  kind: 'product'; product: CatalogueProduct; research: ProductResearch; technical: SpecRow[];
  priceMin: string; priceMax: string; moq: string; currency: string; unit: string;
  leadTime: string; terms: string; availability: string; minimumPriceQuantity: string;
  priceTiers: {quantity: string; price: string}[];
};
type Draft = CompanyDraft | ProductDraft;
type FilterState = 'all' | 'published' | 'hidden';

const countries = ['TR', 'MA', 'TN', 'RS', 'MK', 'BA', 'MD', 'GE', 'AL', 'EG'];
const protectedErrors = new Set(['LOGIN_REQUIRED', 'ADMIN_REQUIRED', 'OWNER_REQUIRED', 'PERMISSION_REQUIRED', 'MFA_REQUIRED', 'EMAIL_UNCONFIRMED', 'USER_INACTIVE']);
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cleanList = (values: string[]) => values.map(value => value.trim()).filter(Boolean);
const nullable = (value: string) => value.trim() || null;
const cleanSources = (values: ResearchSource[]) => values.filter(value => value.url.trim() || value.title.trim() || value.supports?.trim());
const numeric = (value: string) => {
  const clean = value.trim().replace(',', '.');
  return clean === '' ? null : /^\d+(?:\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
};
const responseCode = (value: unknown) => {
  if (!value || typeof value !== 'object') return 'UNAVAILABLE';
  const record = value as Record<string, unknown>;
  return typeof record.errorCode === 'string' ? record.errorCode : typeof record.error === 'string' ? record.error : 'UNAVAILABLE';
};

function blankCompanyResearch(company: CatalogueCompany): CompanyResearch {
  return {
    kind: 'gsl_research', schemaVersion: 1, sourceId: company.id, checkedAt: new Date().toISOString().slice(0, 10),
    sector: '', family: '', categories: [], productFamilies: '', processes: '', certifications: '',
    certificationStatus: '', certificationDates: '', evidenceLevel: 'N', europeanMarket: '',
    agreement: {code: company.country, agreement: '', date: '', benefit: '', proof: '', limits: '', sources: []},
    regulations: [], sources: [],
  };
}

function companyDraft(company: CatalogueCompany): CompanyDraft {
  return {kind: 'company', company: structuredClone(company), research: structuredClone(companyResearch(company.details) || blankCompanyResearch(company))};
}

function productDraft(product: CatalogueProduct, company?: CatalogueCompany): ProductDraft {
  const existing = productResearch(product.specifications);
  const research: ProductResearch = structuredClone(existing || {
    kind: 'gsl_research', schemaVersion: 1, sourceId: product.id, checkedAt: new Date().toISOString().slice(0, 10),
    companySourceId: companyResearch(company?.details)?.sourceId || product.companyId,
    specifications: Object.fromEntries(Object.entries(product.specifications).filter(([key]) => key !== 'research_data')),
    applications: [], materials: [], customization: null,
    commercial: {price_min: null, price_max: null, currency: null, unit: null, moq: null, lead_time: null, terms: null, status: 'non_publie'},
    sources: [],
  });
  return {
    kind: 'product', product: structuredClone(product), research,
    technical: Object.entries(research.specifications).map(([key, value]) => ({key, value})),
    priceMin: research.commercial.price_min?.toString() || '', priceMax: research.commercial.price_max?.toString() || '',
    moq: research.commercial.moq?.toString() || '', currency: research.commercial.currency || '', unit: research.commercial.unit || '',
    leadTime: research.commercial.lead_time || '', terms: research.commercial.terms || '',
    availability: typeof research.commercial.availability === 'string' ? research.commercial.availability : '',
    minimumPriceQuantity: typeof research.commercial.minimum_price_quantity === 'number' ? research.commercial.minimum_price_quantity.toString() : '',
    priceTiers: Array.isArray(research.commercial.price_tiers) ? research.commercial.price_tiers.map((tier: {quantity: number; price: number}) => ({quantity: String(tier.quantity), price: String(tier.price)})) : [],
  };
}

function makeMutation(draft: Draft): CatalogueMutation {
  if (draft.kind === 'company') {
    const {company: value, research} = draft;
    return {
      action: 'save_company', id: value.id, revision: value.revision, name: value.name.trim(),
      country: value.country, city: value.city.trim(), description: value.description.trim(),
      processes: cleanList(value.processes), materials: cleanList(value.materials), website: nullable(value.website || ''),
      research: {...research, categories: cleanList(research.categories), sources: cleanSources(research.sources)},
    };
  }
  const rows = draft.technical.filter(row => row.key.trim() || row.value.trim());
  const keys = rows.map(row => row.key.trim());
  if (new Set(keys).size !== keys.length) throw Error('DUPLICATE_SPECIFICATIONS');
  const technical = Object.fromEntries(rows.map(row => [row.key.trim(), row.value.trim()]));
  const oldResearch = productResearch(draft.product.specifications);
  const oldTechnical = new Set(Object.keys(oldResearch?.specifications || draft.product.specifications));
  const preserved = Object.fromEntries(Object.entries(draft.product.specifications).filter(([key]) => key !== 'research_data' && !oldTechnical.has(key)));
  const moq = draft.moq.trim();
  const research: ProductResearch = {
    ...draft.research, specifications: technical, applications: cleanList(draft.research.applications),
    materials: cleanList(draft.research.materials), customization: nullable(draft.research.customization || ''),
    sources: cleanSources(draft.research.sources),
    commercial: {
      price_min: numeric(draft.priceMin), price_max: numeric(draft.priceMax), currency: nullable(draft.currency.toUpperCase()),
      unit: nullable(draft.unit), moq: numeric(moq),
      lead_time: nullable(draft.leadTime), terms: nullable(draft.terms), status: draft.research.commercial.status.trim(),
      ...(draft.availability || 'availability' in draft.research.commercial ? {availability: nullable(draft.availability)} : {}),
      ...(draft.minimumPriceQuantity || 'minimum_price_quantity' in draft.research.commercial ? {minimum_price_quantity: numeric(draft.minimumPriceQuantity)} : {}),
      ...(draft.priceTiers.length || 'price_tiers' in draft.research.commercial ? {price_tiers: draft.priceTiers.map(tier => ({quantity: numeric(tier.quantity), price: numeric(tier.price)}))} : {}),
    },
  };
  // Validate before serialization: JSON.stringify would otherwise turn NaN into null.
  const numbers = [research.commercial.price_min, research.commercial.price_max, research.commercial.moq, research.commercial.minimum_price_quantity, ...draft.priceTiers.flatMap(tier => [numeric(tier.quantity), numeric(tier.price)])];
  if (numbers.some(value => typeof value === 'number' && !Number.isFinite(value))) throw Error('INVALID_NUMBER');
  return {
    action: 'save_product', id: draft.product.id, revision: draft.product.revision,
    name: draft.product.name.trim(), reference: draft.product.reference.trim(), category: draft.product.category,
    description: draft.product.description.trim(), specifications: {...preserved, ...technical, research_data: JSON.stringify(research)},
  };
}

function Field({label, hint, wide = false, children}: {label: string; hint?: string; wide?: boolean; children: ReactNode}) {
  return <label className={'cat-field' + (wide ? ' cat-field-wide' : '')}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Section({title, description, children}: {title: string; description?: string; children: ReactNode}) {
  return <section className="cat-editor-section"><div className="cat-section-heading"><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</section>;
}

function StringList({label, values, onChange, l}: {label: string; values: string[]; onChange: (values: string[]) => void; l: Translate}) {
  return <div className="cat-list-field"><h3>{label}</h3>{values.length === 0 && <p className="cat-muted">{l('Not provided', 'Non communiqué')}</p>}
    {values.map((value, index) => <div className="cat-inline-input" key={index}><input aria-label={`${label} ${index + 1}`} value={value} maxLength={500} onChange={event => onChange(values.map((item, current) => current === index ? event.target.value : item))}/><button type="button" className="cat-icon-button" aria-label={l('Remove item', 'Retirer cet élément')} onClick={() => onChange(values.filter((_, current) => current !== index))}><X size={16}/></button></div>)}
    <button type="button" className="cat-text-button" onClick={() => onChange([...values, ''])}><Plus size={15}/>{l('Add an item', 'Ajouter un élément')}</button>
  </div>;
}

function SourcesEditor({sources, onChange, l}: {sources: ResearchSource[]; onChange: (value: ResearchSource[]) => void; l: Translate}) {
  const update = (index: number, key: keyof ResearchSource, value: string) => onChange(sources.map((source, current) => current === index ? {...source, [key]: value} : source));
  return <div className="cat-sources-editor">
    {sources.length === 0 && <p className="cat-empty-inline">{l('Add at least one public source to document this record.', 'Ajoutez au moins une source publique pour documenter cette fiche.')}</p>}
    {sources.map((source, index) => <div className="cat-source-card" key={index}>
      <div className="cat-source-heading"><strong>{l('Source', 'Source')} {index + 1}</strong><div className="cat-row-actions">{safeSourceUrl(source.url) && <a href={safeSourceUrl(source.url)!} target="_blank" rel="noopener noreferrer" className="cat-icon-button" aria-label={l('Open source', 'Ouvrir la source')}><ExternalLink size={16}/></a>}<button type="button" className="cat-icon-button" onClick={() => onChange(sources.filter((_, current) => current !== index))} aria-label={l('Remove source', 'Retirer la source')}><Trash2 size={16}/></button></div></div>
      <div className="cat-form-grid"><Field label={l('Document or page title', 'Titre du document ou de la page')}><input value={source.title} maxLength={500} onChange={event => update(index, 'title', event.target.value)}/></Field><Field label={l('Public URL', 'URL publique')}><input type="url" value={source.url} maxLength={2048} placeholder="https://…" onChange={event => update(index, 'url', event.target.value)}/></Field><Field label={l('What this source establishes', 'Ce que cette source établit')} wide><textarea rows={2} value={source.supports || ''} maxLength={4000} onChange={event => update(index, 'supports', event.target.value)}/></Field></div>
    </div>)}
    <button type="button" className="cat-button cat-button-secondary" onClick={() => onChange([...sources, {url: '', title: '', supports: ''}])}><Plus size={16}/>{l('Add a source', 'Ajouter une source')}</button>
  </div>;
}

function SourceLinks({sources, l}: {sources: ResearchSource[]; l: Translate}) {
  return <ul className="cat-source-links">{sources.map((source, index) => {
    const url = safeSourceUrl(source.url);
    return <li key={`${source.url}-${index}`}>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{source.title || l('Source document', 'Document source')}<ArrowUpRight size={13}/></a> : <span>{source.title}</span>}{source.supports && <small>{source.supports}</small>}</li>;
  })}</ul>;
}

function CompanyEditor({draft, onChange, l, countryName}: {draft: CompanyDraft; onChange: (draft: CompanyDraft) => void; l: Translate; countryName: (code: string) => string}) {
  const {company, research} = draft;
  const setCompany = <K extends keyof CatalogueCompany>(key: K, value: CatalogueCompany[K]) => onChange({...draft, company: {...company, [key]: value}});
  const setResearch = <K extends keyof CompanyResearch>(key: K, value: CompanyResearch[K]) => onChange({...draft, research: {...research, [key]: value}});
  const evidenceLabels: Record<CompanyResearch['evidenceLevel'], string> = {
    D: l('Document consulted', 'Document consulté'), R: l('Official third-party register consulted', 'Registre tiers officiel consulté'),
    F: l('Manufacturer statement', 'Déclaration du fabricant'), H: l('Historical or expired evidence', 'Éléments historiques ou expirés'),
    N: l('No public evidence found', 'Aucune preuve publique retrouvée'),
  };
  return <>
    <Section title={l('Company profile', 'Fiche fabricant')} description={l('Public information used in the manufacturer directory.', 'Informations publiques utilisées dans l’annuaire des fabricants.')}>
      <div className="cat-form-grid"><Field label={l('Company name', 'Nom du fabricant')}><input value={company.name} maxLength={250} onChange={event => setCompany('name', event.target.value)}/></Field><Field label={l('Country', 'Pays')}><select value={company.country} onChange={event => setCompany('country', event.target.value)}>{countries.map(code => <option key={code} value={code}>{countryName(code)}</option>)}</select></Field><Field label={l('City', 'Ville')}><input value={company.city} maxLength={250} onChange={event => setCompany('city', event.target.value)}/></Field><Field label={l('Official website', 'Site officiel')}><input type="url" value={company.website || ''} maxLength={2048} placeholder="https://…" onChange={event => setCompany('website', event.target.value || null)}/></Field><Field label={l('Public description', 'Description publique')} wide><textarea rows={5} value={company.description} maxLength={12000} onChange={event => setCompany('description', event.target.value)}/></Field></div>
      <div className="cat-form-grid"><StringList label={l('Manufacturing processes', 'Procédés de fabrication')} values={company.processes} onChange={value => setCompany('processes', value)} l={l}/><StringList label={l('Materials', 'Matières')} values={company.materials} onChange={value => setCompany('materials', value)} l={l}/></div>
    </Section>
    <Section title={l('Activities and product families', 'Activités et familles de produits')}>
      <div className="cat-form-grid"><Field label={l('Precise industrial sector', 'Secteur industriel précis')}><textarea rows={3} value={research.sector} maxLength={3000} onChange={event => setResearch('sector', event.target.value)}/></Field><Field label={l('Main family', 'Famille principale')}><textarea rows={3} value={research.family} maxLength={2000} onChange={event => setResearch('family', event.target.value)}/></Field><Field label={l('Verified product families', 'Familles de produits vérifiées')} wide><textarea rows={3} value={research.productFamilies} maxLength={8000} onChange={event => setResearch('productFamilies', event.target.value)}/></Field><Field label={l('Processes and documented capabilities', 'Procédés et capacités documentés')} wide><textarea rows={3} value={research.processes} maxLength={8000} onChange={event => setResearch('processes', event.target.value)}/></Field></div>
      <fieldset className="cat-category-field"><legend>{l('Directory categories', 'Catégories de l’annuaire')}</legend><div className="cat-category-options">{researchCategories.map(category => <label key={category.id}><input type="checkbox" checked={research.categories.includes(category.id)} onChange={event => setResearch('categories', event.target.checked ? [...research.categories, category.id] : research.categories.filter(value => value !== category.id))}/><span>{l(category.en, category.fr)}</span></label>)}</div>{research.categories.filter(value => !researchCategories.some(category => category.id === value)).map(value => <p key={value} className="cat-muted">{value}</p>)}</fieldset>
    </Section>
    <Section title={l('Certifications and evidence', 'Certifications et niveau de preuve')} description={l('Describe the exact claim, its scope and the dates consulted. This section does not certify the manufacturer.', 'Décrivez l’allégation exacte, son périmètre et les dates consultées. Cette rubrique ne certifie pas le fabricant.')}>
      <div className="cat-form-grid"><Field label={l('Standards, certifications and scope', 'Normes, certifications et périmètre')} wide><textarea rows={4} value={research.certifications} maxLength={8000} onChange={event => setResearch('certifications', event.target.value)}/></Field><Field label={l('Full verification status', 'Statut de vérification intégral')}><textarea rows={3} value={research.certificationStatus} maxLength={3000} onChange={event => setResearch('certificationStatus', event.target.value)}/></Field><Field label={l('Validity dates and limitations', 'Dates de validité et limites')}><textarea rows={3} value={research.certificationDates} maxLength={3000} onChange={event => setResearch('certificationDates', event.target.value)}/></Field><Field label={l('Evidence level', 'Niveau de preuve')}><select value={research.evidenceLevel} onChange={event => setResearch('evidenceLevel', event.target.value as CompanyResearch['evidenceLevel'])}>{Object.entries(evidenceLabels).map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</select></Field><Field label={l('Last source check', 'Dernière vérification des sources')}><input type="date" value={research.checkedAt.slice(0, 10)} onChange={event => setResearch('checkedAt', event.target.value)}/></Field><Field label={l('Evidence of European activity', 'Preuves d’activité européenne')} wide><textarea rows={4} value={research.europeanMarket} maxLength={8000} onChange={event => setResearch('europeanMarket', event.target.value)}/></Field></div>
    </Section>
    <Section title={l('Sources and traceability', 'Sources et traçabilité')} description={`${l('Research record', 'Référence de recherche')} · ${research.sourceId}`}><SourcesEditor sources={research.sources} onChange={value => setResearch('sources', value)} l={l}/></Section>
    <Section title={l('Trade agreement and applicable rules', 'Accord commercial et règles applicables')} description={l('Country agreements are maintained centrally. Changing the country updates the agreement when saved.', 'Les accords des pays sont gérés centralement. Un changement de pays actualise l’accord à l’enregistrement.')}>
      <details className="cat-reference" open><summary>{research.agreement.agreement || l('Country agreement', 'Accord du pays')}<ChevronRight size={17}/></summary><div className="cat-reference-body"><dl>{[[l('Dates', 'Dates'), research.agreement.date], [l('Potential benefit', 'Avantage possible'), research.agreement.benefit], [l('Origin evidence', 'Preuve d’origine'), research.agreement.proof], [l('Limits and conditions', 'Limites et conditions'), research.agreement.limits]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || l('Not provided', 'Non communiqué')}</dd></div>)}</dl><SourceLinks sources={research.agreement.sources} l={l}/></div></details>
      {research.regulations.length === 0 && <p className="cat-muted">{l('No product-specific rule documented.', 'Aucune règle spécifique documentée.')}</p>}
      {research.regulations.map((rule, index) => <details className="cat-reference" key={`${rule.id}-${index}`}><summary><span><small>{rule.type}</small>{rule.title}</span><ChevronRight size={17}/></summary><div className="cat-reference-body"><dl>{[[l('Scope', 'Champ d’application'), rule.scope], [l('Requirements', 'Exigences'), rule.requirements], [l('Limits', 'Limites'), rule.limits]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || l('Not provided', 'Non communiqué')}</dd></div>)}</dl><SourceLinks sources={rule.sources} l={l}/></div></details>)}
    </Section>
  </>;
}

function ProductEditor({draft, onChange, l}: {draft: ProductDraft; onChange: (draft: ProductDraft) => void; l: Translate}) {
  const {product, research} = draft;
  const setProduct = <K extends keyof CatalogueProduct>(key: K, value: CatalogueProduct[K]) => onChange({...draft, product: {...product, [key]: value}});
  const setResearch = <K extends keyof ProductResearch>(key: K, value: ProductResearch[K]) => onChange({...draft, research: {...research, [key]: value}});
  const setText = (key: 'priceMin' | 'priceMax' | 'moq' | 'currency' | 'unit' | 'leadTime' | 'terms' | 'availability' | 'minimumPriceQuantity', value: string) => onChange({...draft, [key]: value});
  return <>
    <Section title={l('Product or product family', 'Produit ou famille de produits')}>
      <div className="cat-form-grid"><Field label={l('Product name', 'Nom du produit')} wide><input value={product.name} maxLength={250} onChange={event => setProduct('name', event.target.value)}/></Field><Field label={l('Manufacturer reference', 'Référence fabricant')}><input value={product.reference} maxLength={250} onChange={event => setProduct('reference', event.target.value)}/></Field><Field label={l('Category', 'Catégorie')}><select value={product.category} onChange={event => setProduct('category', event.target.value)}>{!researchCategories.some(category => category.id === product.category) && <option value={product.category}>{product.category}</option>}{researchCategories.map(category => <option key={category.id} value={category.id}>{l(category.en, category.fr)}</option>)}</select></Field><Field label={l('Public description', 'Description publique')} wide><textarea rows={5} value={product.description} maxLength={12000} onChange={event => setProduct('description', event.target.value)}/></Field></div>
    </Section>
    <Section title={l('Structured specifications', 'Caractéristiques structurées')} description={l('Keep the exact unit and scope of each published specification.', 'Conservez l’unité exacte et le périmètre de chaque caractéristique publiée.')}>
      <div className="cat-specifications"><div className="cat-specification-labels"><span>{l('Characteristic', 'Caractéristique')}</span><span>{l('Verified value and unit', 'Valeur et unité vérifiées')}</span></div>{draft.technical.map((row, index) => <div className="cat-specification-row" key={index}><input aria-label={`${l('Characteristic', 'Caractéristique')} ${index + 1}`} value={row.key} maxLength={200} onChange={event => onChange({...draft, technical: draft.technical.map((item, current) => current === index ? {...item, key: event.target.value} : item)})}/><textarea aria-label={`${l('Value', 'Valeur')} ${index + 1}`} rows={2} value={row.value} maxLength={6000} onChange={event => onChange({...draft, technical: draft.technical.map((item, current) => current === index ? {...item, value: event.target.value} : item)})}/><button type="button" className="cat-icon-button" aria-label={l('Remove characteristic', 'Retirer cette caractéristique')} onClick={() => onChange({...draft, technical: draft.technical.filter((_, current) => current !== index)})}><Trash2 size={16}/></button></div>)}{draft.technical.length === 0 && <p className="cat-muted">{l('No published specifications.', 'Aucune caractéristique publiée.')}</p>}<button type="button" className="cat-text-button" onClick={() => onChange({...draft, technical: [...draft.technical, {key: '', value: ''}]})}><Plus size={15}/>{l('Add a characteristic', 'Ajouter une caractéristique')}</button></div>
      <div className="cat-form-grid"><StringList label={l('Applications', 'Applications')} values={research.applications} onChange={value => setResearch('applications', value)} l={l}/><StringList label={l('Materials', 'Matières')} values={research.materials} onChange={value => setResearch('materials', value)} l={l}/><Field label={l('Documented customization', 'Personnalisation documentée')} wide><textarea rows={3} value={research.customization || ''} maxLength={4000} onChange={event => setResearch('customization', event.target.value || null)}/></Field><Field label={l('Scope and limitations', 'Périmètre et limites')} wide><textarea rows={3} value={research.scopeNote || ''} maxLength={6000} onChange={event => setResearch('scopeNote', event.target.value)}/></Field></div>
    </Section>
    <Section title={l('Verified commercial information', 'Informations commerciales vérifiées')} description={l('Enter only published information supported by the sources below. An empty field is saved as unknown.', 'Saisissez uniquement des informations publiées, appuyées par les sources ci-dessous. Un champ vide est enregistré comme inconnu.')}>
      <div className="cat-note"><FileCheck2 size={18}/><p>{l('Copy the exact price, currency and unit. Use the same value for minimum and maximum when a single price is published. Record quantity discounts and availability in the conditions.', 'Recopiez le prix, la devise et l’unité exacts. Utilisez la même valeur minimum et maximum lorsqu’un prix unique est publié. Précisez les remises par quantité et la disponibilité dans les conditions.')}</p></div>
      <div className="cat-form-grid cat-commercial-grid"><Field label={l('Minimum published price', 'Prix publié minimum')}><input inputMode="decimal" value={draft.priceMin} onChange={event => setText('priceMin', event.target.value)} placeholder={l('Not provided', 'Non communiqué')}/></Field><Field label={l('Maximum published price', 'Prix publié maximum')}><input inputMode="decimal" value={draft.priceMax} onChange={event => setText('priceMax', event.target.value)} placeholder={l('Not provided', 'Non communiqué')}/></Field><Field label={l('Currency', 'Devise')} hint={l('ISO code, e.g. EUR or USD', 'Code ISO, par ex. EUR ou USD')}><input value={draft.currency} maxLength={3} onChange={event => setText('currency', event.target.value.toUpperCase())} placeholder={l('Not provided', 'Non communiqué')}/></Field><Field label={l('Exact selling unit', 'Unité de vente exacte')}><input value={draft.unit} maxLength={200} onChange={event => setText('unit', event.target.value)} placeholder={l('Not provided', 'Non communiqué')}/></Field><Field label={l('Minimum order quantity', 'Quantité minimale de commande')} hint={l('Published positive quantity', 'Quantité positive publiée')}><input value={draft.moq} maxLength={500} onChange={event => setText('moq', event.target.value)} placeholder={l('Not provided', 'Non communiqué')}/></Field><Field label={l('Published lead time', 'Délai publié')}><input value={draft.leadTime} maxLength={2000} onChange={event => setText('leadTime', event.target.value)} placeholder={l('Not provided', 'Non communiqué')}/></Field><Field label={l('Commercial verification status', 'Statut de vérification commerciale')} wide><input value={research.commercial.status} maxLength={1000} onChange={event => setResearch('commercial', {...research.commercial, status: event.target.value})} list="cat-commercial-statuses"/><datalist id="cat-commercial-statuses"><option value="non_publie"/><option value="prix_public"/><option value="prix_public_hors_stock"/><option value="prix_non_publie_moq_publie"/></datalist></Field><Field label={l('Published terms, discounts and availability', 'Conditions, remises et disponibilité publiées')} wide><textarea rows={4} value={draft.terms} maxLength={8000} onChange={event => setText('terms', event.target.value)} placeholder={l('Not provided', 'Non communiqué')}/></Field></div>
      <div className="cat-form-grid" style={{marginTop: 20}}><Field label={l('Published availability', 'Disponibilité publiée')}><textarea rows={2} value={draft.availability} maxLength={2000} onChange={event => setText('availability', event.target.value)} placeholder={l('Not provided', 'Non communiquée')}/></Field><Field label={l('Quantity required for the minimum price', 'Quantité donnant accès au prix minimum')} hint={l('Keep the published quantity break attached to its price.', 'Conservez le seuil de quantité publié associé au prix.')}><input inputMode="decimal" value={draft.minimumPriceQuantity} onChange={event => setText('minimumPriceQuantity', event.target.value)} placeholder={l('Not provided', 'Non communiquée')}/></Field></div>
      <div className="cat-price-tiers"><h3>{l('Published quantity prices', 'Prix publiés par quantité')}</h3>{draft.priceTiers.map((tier, index) => <div className="cat-price-tier" key={index}><Field label={`${l('From quantity', 'À partir de la quantité')} ${index + 1}`}><input inputMode="decimal" value={tier.quantity} onChange={event => onChange({...draft, priceTiers: draft.priceTiers.map((item, current) => current === index ? {...item, quantity: event.target.value} : item)})}/></Field><Field label={l('Exact unit price', 'Prix unitaire exact')}><input inputMode="decimal" value={tier.price} onChange={event => onChange({...draft, priceTiers: draft.priceTiers.map((item, current) => current === index ? {...item, price: event.target.value} : item)})}/></Field><button type="button" className="cat-icon-button" aria-label={l('Remove quantity break', 'Retirer le palier')} onClick={() => onChange({...draft, priceTiers: draft.priceTiers.filter((_, current) => current !== index)})}><Trash2 size={16}/></button></div>)}<button type="button" className="cat-text-button" onClick={() => onChange({...draft, priceTiers: [...draft.priceTiers, {quantity: '', price: ''}]})}><Plus size={15}/>{l('Add a published quantity break', 'Ajouter un palier publié')}</button></div>
    </Section>
    <Section title={l('Sources and traceability', 'Sources et traçabilité')} description={`${l('Research record', 'Référence de recherche')} · ${research.sourceId}`}><div className="cat-form-grid"><Field label={l('Last source check', 'Dernière vérification des sources')}><input type="date" value={research.checkedAt.slice(0, 10)} onChange={event => setResearch('checkedAt', event.target.value)}/></Field></div><SourcesEditor sources={research.sources} onChange={value => setResearch('sources', value)} l={l}/></Section>
  </>;
}

function errorMessage(code: string, l: Translate) {
  const messages: Record<string, [string, string]> = {
    LOGIN_REQUIRED: ['Sign in to your owner account to access the catalogue.', 'Connectez-vous à votre compte propriétaire pour accéder au catalogue.'],
    ADMIN_REQUIRED: ['This catalogue is reserved for active owners.', 'Ce catalogue est réservé aux propriétaires actifs.'],
    OWNER_REQUIRED: ['Only an active owner can manage this catalogue.', 'Seul un propriétaire actif peut gérer ce catalogue.'],
    PERMISSION_REQUIRED: ['Your account does not have permission to manage this catalogue.', 'Votre compte n’a pas l’autorisation de gérer ce catalogue.'],
    MFA_REQUIRED: ['Confirm your identity with two-factor authentication to continue.', 'Confirmez votre identité par authentification à deux facteurs pour continuer.'],
    EMAIL_UNCONFIRMED: ['Confirm your account email before continuing.', 'Confirmez l’adresse e-mail de votre compte avant de continuer.'],
    USER_INACTIVE: ['Your owner access is not active.', 'Votre accès propriétaire n’est pas actif.'],
    CONFLICT: ['This record was changed by another owner. Your draft is preserved. Load the current version before saving again.', 'Un autre propriétaire a modifié cette fiche. Votre brouillon est conservé. Chargez la version actuelle avant d’enregistrer à nouveau.'],
    NOT_FOUND: ['This record is no longer available. Refresh the catalogue.', 'Cette fiche n’est plus disponible. Actualisez le catalogue.'],
    NOT_CONFIGURED: ['Catalogue management is not configured yet. The protected backend must be installed.', 'La gestion du catalogue n’est pas encore configurée. Le service sécurisé doit être installé.'],
    INVALID: ['Some fields are invalid. Check the required information, source URLs and commercial values.', 'Certains champs sont invalides. Vérifiez les informations obligatoires, les URL des sources et les valeurs commerciales.'],
    INVALID_NUMBER: ['Enter a positive decimal price or leave the field empty.', 'Saisissez un prix décimal positif ou laissez le champ vide.'],
    DUPLICATE_SPECIFICATIONS: ['Each characteristic must have a different name.', 'Chaque caractéristique doit avoir un nom différent.'],
    ORIGIN: ['This request could not be verified. Reload the page from the GSL website.', 'Cette requête n’a pas pu être vérifiée. Rechargez la page depuis le site GSL.'],
    UNAVAILABLE: ['The catalogue could not be loaded or saved. Please retry.', 'Le catalogue n’a pas pu être chargé ou enregistré. Réessayez.'],
  };
  return l(...(messages[code] || messages.UNAVAILABLE));
}

export default function AdminCatalogue() {
  const {l, language, setLanguage} = useLanguage();
  const [snapshot, setSnapshot] = useState<CatalogueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState('');
  const [discard, setDiscard] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [tab, setTab] = useState<'companies' | 'products'>('companies');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('all');
  const [category, setCategory] = useState('all');
  const [publication, setPublication] = useState<FilterState>('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const requestRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const editorHeading = useRef<HTMLHeadingElement | null>(null);
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  const companyMap = useMemo(() => new Map(snapshot?.companies.map(value => [value.id, value]) || []), [snapshot]);
  const countryName = useCallback((code: string) => {
    try {return new Intl.DisplayNames([language], {type: 'region'}).of(code) || code;} catch {return code;}
  }, [language]);
  const categoryName = (id: string) => {const value = researchCategories.find(item => item.id === id); return value ? l(value.en, value.fr) : id;};

  const receiveError = useCallback((code: string) => {
    setError(code);
    if (protectedErrors.has(code)) {setSnapshot(null); setDraft(null); setBaseline(''); setIssues([]);}
  }, []);

  const load = useCallback(async (): Promise<CatalogueSnapshot | null> => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch('/api/admin/catalogue', {cache: 'no-store', credentials: 'same-origin', signal: controller.signal});
      const value = await response.json();
      if (!response.ok) throw Error(responseCode(value));
      const parsed = catalogueSnapshotSchema.safeParse(value);
      if (!parsed.success) throw Error('UNAVAILABLE');
      setSnapshot(parsed.data);
      return parsed.data;
    } catch (caught) {
      if (!controller.signal.aborted) receiveError(caught instanceof Error ? caught.message : 'UNAVAILABLE');
      return null;
    } finally {if (!controller.signal.aborted) setLoading(false);}
  }, [receiveError]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => {cancelAnimationFrame(frame); requestRef.current?.abort();};
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault();};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const refresh = () => {if (document.visibilityState === 'visible' && !busyRef.current) void load();};
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openDraft = (value: Draft) => {
    setDraft(value); setBaseline(JSON.stringify(value)); setDiscard(false); setError(''); setIssues([]);
    requestAnimationFrame(() => {editorHeading.current?.focus(); editorHeading.current?.scrollIntoView({block: 'start'});});
  };
  const closeDraft = () => {
    if (busy || loading) return;
    if (dirty && !discard) {setDiscard(true); return;}
    setDraft(null); setBaseline(''); setDiscard(false); setError(''); setIssues([]);
  };

  const send = async (input: CatalogueMutation): Promise<number | null> => {
    if (busyRef.current) return null;
    busyRef.current = true; setBusy(true); setError(''); setIssues([]); setNotice('');
    try {
      const response = await fetch('/api/admin/catalogue', {method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input)});
      const value = await response.json();
      if (!response.ok) throw Error(responseCode(value));
      if (!value || typeof value !== 'object' || !('saved' in value) || value.saved !== true || !('revision' in value) || typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision)) throw Error('UNAVAILABLE');
      return value.revision;
    } catch (caught) {receiveError(caught instanceof Error ? caught.message : 'UNAVAILABLE'); return null;}
    finally {busyRef.current = false; setBusy(false);}
  };

  const saveDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    let input: CatalogueMutation;
    try {input = makeMutation(draft);} catch (caught) {setError(caught instanceof Error ? caught.message : 'INVALID'); return;}
    const parsed = catalogueMutationSchema.safeParse(input);
    if (!parsed.success) {
      setError('INVALID');
      setIssues([...new Set(parsed.error.issues.map(issue => issue.path.join(' › ')))].slice(0, 10));
      return;
    }
    const revision = await send(parsed.data);
    if (revision === null) return;
    const saved: Draft = draft.kind === 'company'
      ? {...draft, company: {...draft.company, revision}}
      : {...draft, product: {...draft.product, revision}};
    setDraft(saved); setBaseline(JSON.stringify(saved)); setNotice('saved'); setDiscard(false);
    const latest = await load();
    if (latest) {
      const value = saved.kind === 'company' ? latest.companies.find(item => item.id === saved.company.id) : latest.products.find(item => item.id === saved.product.id);
      if (value) {
        const next = saved.kind === 'company' ? companyDraft(value as CatalogueCompany) : productDraft(value as CatalogueProduct, latest.companies.find(company => company.id === (value as CatalogueProduct).companyId));
        setDraft(next); setBaseline(JSON.stringify(next));
      }
    }
  };

  const visibility = async (value: CatalogueCompany | CatalogueProduct, kind: 'company' | 'product') => {
    const input: CatalogueMutation = {action: kind === 'company' ? 'set_company_visibility' : 'set_product_visibility', id: value.id, revision: value.revision, published: !value.published};
    const revision = await send(input);
    if (revision === null) return;
    setSnapshot(current => current ? {...current, [kind === 'company' ? 'companies' : 'products']: (kind === 'company' ? current.companies : current.products).map(item => item.id === value.id ? {...item, published: !value.published, revision} : item)} : current);
    setNotice(value.published ? 'hidden' : 'published');
    await load();
  };

  const reloadDraft = async () => {
    const current = draft;
    const latest = await load();
    if (!latest || !current) return;
    if (current.kind === 'company') {
      const value = latest.companies.find(item => item.id === current.company.id);
      if (value) openDraft(companyDraft(value)); else setError('NOT_FOUND');
    } else {
      const value = latest.products.find(item => item.id === current.product.id);
      if (value) openDraft(productDraft(value, latest.companies.find(item => item.id === value.companyId))); else setError('NOT_FOUND');
    }
  };

  const search = fold(query.trim());
  const filteredCompanies = snapshot?.companies.filter(value => {
    const research = companyResearch(value.details);
    return (country === 'all' || value.country === country)
      && (category === 'all' || research?.categories.includes(category))
      && (publication === 'all' || value.published === (publication === 'published'))
      && (!search || fold([value.name, value.city, countryName(value.country), research?.sector, research?.sourceId, research?.productFamilies].join(' ')).includes(search));
  }) || [];
  const filteredProducts = snapshot?.products.filter(value => {
    const company = companyMap.get(value.companyId);
    const published = value.published && company?.published === true;
    return (country === 'all' || company?.country === country)
      && (companyFilter === 'all' || value.companyId === companyFilter)
      && (category === 'all' || value.category === category)
      && (publication === 'all' || published === (publication === 'published'))
      && (!search || fold([value.name, value.reference, value.description, company?.name, categoryName(value.category)].join(' ')).includes(search));
  }) || [];
  const visibleCompanies = snapshot?.companies.filter(value => value.published).length || 0;
  const visibleProducts = snapshot?.products.filter(value => value.published && companyMap.get(value.companyId)?.published).length || 0;
  const rowsCount = tab === 'companies' ? filteredCompanies.length : filteredProducts.length;
  const editorValue = draft?.kind === 'company' ? draft.company : draft?.product;
  const publicPath = draft?.kind === 'company' ? `/fabricants/${draft.company.id}` : draft ? `/produits/${draft.product.id}` : '';

  return <div className="gsl-catalogue-admin" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <header className="cat-topbar"><div><Link href="/administration" className="cat-back-link"><ArrowLeft size={17}/>{l('Administration', 'Administration')}</Link><ChevronRight size={13}/><strong>{l('Catalogue', 'Catalogue')}</strong></div><label className="cat-language"><Globe2 size={16}/><span className="cat-sr-only">{l('Language', 'Langue')}</span><select value={language} onChange={event => setLanguage(event.target.value as Language)}>{adminLanguages.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label></header>
    <main className="cat-main"><div className="cat-page-heading"><div><span className="cat-eyebrow"><ShieldCheck size={14}/>{l('Owner workspace', 'Espace propriétaires')}</span><h1>{l('Manage the catalogue', 'Piloter le catalogue')}</h1><p>{l('Maintain sourced manufacturer profiles, product specifications and their publication.', 'Maintenez les fiches fabricants sourcées, les caractéristiques produits et leur publication.')}</p></div><div className="cat-heading-actions"><Link href="/catalogue" target="_blank" rel="noopener noreferrer" className="cat-button cat-button-secondary">{l('Public catalogue', 'Catalogue public')}<ExternalLink size={16}/></Link><button className="cat-button cat-button-secondary" type="button" disabled={loading || busy} onClick={() => {setError(''); void load();}}><RefreshCw size={16} className={loading ? 'cat-spin' : ''}/>{l('Refresh', 'Actualiser')}</button></div></div>
      {notice && <div role="status" className="cat-alert cat-alert-success"><Check size={18}/><p>{notice === 'saved' ? l('The record has been saved.', 'La fiche a été enregistrée.') : notice === 'hidden' ? l('The record is now hidden from the public catalogue.', 'La fiche est maintenant masquée dans le catalogue public.') : l('Publication has been restored. Product visibility also depends on its company.', 'La publication est rétablie. La visibilité d’un produit dépend aussi de son fabricant.')}</p><button className="cat-icon-button" onClick={() => setNotice('')} aria-label={l('Dismiss', 'Fermer')}><X size={16}/></button></div>}
      {error && <div role="alert" className="cat-alert cat-alert-error"><CircleAlert size={19}/><div><p>{errorMessage(error, l)}</p>{issues.length > 0 && <p className="cat-error-fields">{l('Fields to review', 'Champs à vérifier')} : {issues.join(' ; ')}</p>}{error === 'CONFLICT' && draft && <button type="button" className="cat-button cat-button-secondary" onClick={() => void reloadDraft()} disabled={busy || loading}>{l('Replace my draft with the current version', 'Remplacer mon brouillon par la version actuelle')}</button>}</div></div>}
      {!snapshot ? <section className="cat-gate" aria-busy={loading}>{loading ? <><LoaderCircle size={32} className="cat-spin"/><h2>{l('Opening your catalogue…', 'Ouverture de votre catalogue…')}</h2></> : <><ShieldCheck size={36}/><h2>{l('Protected catalogue management', 'Gestion protégée du catalogue')}</h2><p>{errorMessage(error || 'UNAVAILABLE', l)}</p>{error === 'LOGIN_REQUIRED' ? <Link className="cat-button cat-button-primary" href="/connexion?next=%2Fadministration%2Fcatalogue">{l('Sign in', 'Se connecter')}</Link> : error === 'MFA_REQUIRED' ? <Link className="cat-button cat-button-primary" href="/compte/securite?next=%2Fadministration%2Fcatalogue">{l('Confirm my identity', 'Confirmer mon identité')}</Link> : protectedErrors.has(error) ? <Link className="cat-button cat-button-secondary" href="/compte">{l('My account', 'Mon compte')}</Link> : <button className="cat-button cat-button-primary" onClick={() => void load()}>{l('Retry', 'Réessayer')}</button>}</>}</section> : <>
        <section className="cat-metrics" aria-label={l('Catalogue overview', 'Aperçu du catalogue')}><article><span className="cat-metric-icon"><Building2 size={22}/></span><div><span>{l('Manufacturers', 'Fabricants')}</span><strong>{snapshot.companies.length}</strong><small>{visibleCompanies} {l('published', 'publiés')} · {snapshot.companies.length - visibleCompanies} {l('hidden', 'masqués')}</small></div></article><article><span className="cat-metric-icon"><Package size={22}/></span><div><span>{l('Products & families', 'Produits et familles')}</span><strong>{snapshot.products.length}</strong><small>{visibleProducts} {l('publicly visible', 'visibles publiquement')}</small></div></article><article><span className="cat-metric-icon"><Globe2 size={22}/></span><div><span>{l('Countries covered', 'Pays couverts')}</span><strong>{new Set(snapshot.companies.map(value => value.country)).size}</strong><small>{l('Sourced industrial profiles', 'Fiches industrielles sourcées')}</small></div></article><article><span className="cat-metric-icon"><Mail size={22}/></span><div><span>{l('Owner notifications', 'Notifications propriétaires')}</span><strong>{snapshot.notificationStatus.pending}</strong><small>{l('pending', 'en attente')} · {snapshot.notificationStatus.failed} {l('failed', 'en échec')}</small></div></article></section>
        <details className={'cat-notifications' + (!snapshot.emailConfigured ? ' cat-notifications-warning' : '')}><summary><Mail size={18}/><span><strong>{snapshot.emailConfigured ? l('Owner notification settings', 'Paramètres des notifications propriétaires') : l('Email delivery must be configured', 'Envoi des e-mails à configurer')}</strong><small>{snapshot.emailConfigured ? l('Configuration detected. Delivery depends on the notification worker.', 'Configuration détectée. La livraison dépend du service de notifications.') : l('The email worker is not fully configured. Pending notifications are not a delivery confirmation.', 'Le service d’envoi n’est pas entièrement configuré. Les notifications en attente ne confirment aucun envoi.')}</small></span><ChevronRight size={17}/></summary><div><p>{l('Recipients are the active owner accounts. Access and recipient changes are managed in administration.', 'Les destinataires sont les comptes propriétaires actifs. Les accès et destinataires se gèrent dans l’administration.')}</p>{snapshot.recipients.length ? <ul>{snapshot.recipients.map(recipient => <li key={recipient.userId}><strong>{recipient.name || l('Owner', 'Propriétaire')}</strong><span>{recipient.email}</span></li>)}</ul> : <p>{l('No owner recipient returned.', 'Aucun destinataire propriétaire retourné.')}</p>}<Link href="/administration#access">{l('Manage owner access', 'Gérer les accès propriétaires')}<ArrowUpRight size={14}/></Link></div></details>
        {draft && editorValue ? <div className="cat-editor"><div className="cat-editor-heading"><div><button type="button" className="cat-text-button" onClick={closeDraft} disabled={busy}><ArrowLeft size={16}/>{l('Back to records', 'Revenir aux fiches')}</button><h2 ref={editorHeading} tabIndex={-1}>{editorValue.name}</h2><p>{draft.kind === 'company' ? l('Manufacturer profile', 'Fiche fabricant') : companyMap.get(draft.product.companyId)?.name} · {l('Revision', 'Version')} {editorValue.revision}<span className={'cat-status ' + (editorValue.published ? 'cat-status-published' : '')}>{editorValue.published ? l('Published', 'Publié') : l('Hidden', 'Masqué')}</span></p></div><Link href={publicPath} className="cat-button cat-button-secondary" target="_blank" rel="noopener noreferrer">{l('Public page', 'Page publique')}<ExternalLink size={16}/></Link></div>
          {discard && <div className="cat-discard" role="alert"><p>{l('This draft contains unsaved changes.', 'Ce brouillon contient des modifications non enregistrées.')}</p><button className="cat-button cat-button-secondary" type="button" onClick={() => setDiscard(false)}>{l('Continue editing', 'Continuer l’édition')}</button><button className="cat-button cat-button-danger" type="button" onClick={closeDraft}>{l('Discard this draft', 'Abandonner ce brouillon')}</button></div>}
          {draft.kind === 'product' && !companyMap.get(draft.product.companyId)?.published && <div className="cat-note"><EyeOff size={18}/><p>{l('The company is hidden. This product stays unavailable publicly until its company is republished.', 'Le fabricant est masqué. Ce produit reste indisponible publiquement jusqu’à la republication du fabricant.')}</p></div>}
          <form onSubmit={event => void saveDraft(event)} noValidate><fieldset className="cat-editor-fields" disabled={busy || loading}>{draft.kind === 'company' ? <CompanyEditor draft={draft} onChange={setDraft} l={l} countryName={countryName}/> : <ProductEditor draft={draft} onChange={setDraft} l={l}/>}</fieldset><footer className="cat-save-bar"><div><span className={'cat-draft-dot' + (dirty ? ' cat-draft-dirty' : '')}/>{dirty ? l('Unsaved changes', 'Modifications non enregistrées') : l('Up to date', 'À jour')}</div><div><button className="cat-button cat-button-secondary" type="button" onClick={closeDraft} disabled={busy}>{l('Close', 'Fermer')}</button><button className="cat-button cat-button-primary" type="submit" disabled={!dirty || busy || loading || error === 'CONFLICT'}>{busy ? <LoaderCircle size={17} className="cat-spin"/> : <Save size={17}/>} {busy ? l('Saving…', 'Enregistrement…') : l('Save changes', 'Enregistrer les modifications')}</button></div></footer></form>
        </div> : <section className="cat-directory"><div className="cat-tabs" role="tablist" aria-label={l('Record type', 'Type de fiche')}><button type="button" role="tab" aria-selected={tab === 'companies'} className={tab === 'companies' ? 'active' : ''} onClick={() => {setTab('companies'); setCompanyFilter('all');}}><Building2 size={18}/>{l('Manufacturers', 'Fabricants')}<span>{snapshot.companies.length}</span></button><button type="button" role="tab" aria-selected={tab === 'products'} className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}><Package size={18}/>{l('Products', 'Produits')}<span>{snapshot.products.length}</span></button></div>
          <div className="cat-filters"><label className="cat-search"><Search size={18}/><span className="cat-sr-only">{l('Search records', 'Rechercher une fiche')}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'companies' ? l('Name, activity, city…', 'Nom, activité, ville…') : l('Product, reference, manufacturer…', 'Produit, référence, fabricant…')}/>{query && <button type="button" aria-label={l('Clear search', 'Effacer la recherche')} onClick={() => setQuery('')}><X size={15}/></button>}</label><Field label={l('Country', 'Pays')}><select value={country} onChange={event => setCountry(event.target.value)}><option value="all">{l('All countries', 'Tous les pays')}</option>{Array.from(new Set(snapshot.companies.map(value => value.country))).sort((a, b) => countryName(a).localeCompare(countryName(b))).map(value => <option key={value} value={value}>{countryName(value)}</option>)}</select></Field><Field label={l('Category', 'Catégorie')}><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">{l('All categories', 'Toutes les catégories')}</option>{researchCategories.map(value => <option key={value.id} value={value.id}>{l(value.en, value.fr)}</option>)}</select></Field><Field label={l('Public visibility', 'Visibilité publique')}><select value={publication} onChange={event => setPublication(event.target.value as FilterState)}><option value="all">{l('All records', 'Toutes les fiches')}</option><option value="published">{l('Published', 'Publiées')}</option><option value="hidden">{l('Hidden', 'Masquées')}</option></select></Field>{tab === 'products' && <Field label={l('Manufacturer', 'Fabricant')}><select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)}><option value="all">{l('All manufacturers', 'Tous les fabricants')}</option>{snapshot.companies.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></Field>}</div>
          <div className="cat-table-caption"><span>{rowsCount} {l('records match', 'fiches correspondent')}</span>{(query || country !== 'all' || category !== 'all' || publication !== 'all' || companyFilter !== 'all') && <button type="button" className="cat-text-button" onClick={() => {setQuery(''); setCountry('all'); setCategory('all'); setPublication('all'); setCompanyFilter('all');}}>{l('Reset filters', 'Réinitialiser les filtres')}</button>}<span>{l('Changes are saved record by record.', 'Les modifications s’enregistrent fiche par fiche.')}</span></div>
          <div className="cat-table-scroll" role="tabpanel" aria-label={tab === 'companies' ? l('Manufacturers', 'Fabricants') : l('Products', 'Produits')}><table><thead><tr>{(tab === 'companies' ? [l('Manufacturer', 'Fabricant'), l('Activity and evidence', 'Activité et preuve'), l('Products', 'Produits'), l('Publication', 'Publication'), l('Actions', 'Actions')] : [l('Product / family', 'Produit / famille'), l('Manufacturer', 'Fabricant'), l('Commercial data', 'Données commerciales'), l('Publication', 'Publication'), l('Actions', 'Actions')]).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>
            {tab === 'companies' ? filteredCompanies.map(value => {const research = companyResearch(value.details); const products = snapshot.products.filter(product => product.companyId === value.id); return <tr key={value.id}><td><button type="button" className="cat-record-name" onClick={() => openDraft(companyDraft(value))}>{value.name}</button><span className="cat-cell-sub">{countryName(value.country)}{value.city ? ` · ${value.city}` : ''}</span><span className="cat-record-code">{research?.sourceId}</span></td><td><p className="cat-cell-description">{research?.sector || value.description}</p><span className="cat-cell-sub cat-evidence">{research?.certificationStatus || l('No documented status', 'Aucun statut documenté')}</span>{research?.certificationDates && <span className="cat-cell-sub">{research.certificationDates}</span>}</td><td><button type="button" className="cat-count-link" onClick={() => {setTab('products'); setCompanyFilter(value.id); setQuery(''); setCountry('all'); setCategory('all'); setPublication('all');}}>{products.length}<ChevronRight size={14}/></button></td><td><span className={'cat-status ' + (value.published ? 'cat-status-published' : '')}>{value.published ? <Eye size={13}/> : <EyeOff size={13}/>} {value.published ? l('Published', 'Publié') : l('Hidden', 'Masqué')}</span>{research && <span className="cat-cell-sub">{l('Checked', 'Vérifié le')} {research.checkedAt.slice(0, 10)}</span>}</td><td><div className="cat-row-actions"><button type="button" className="cat-button cat-button-small" onClick={() => openDraft(companyDraft(value))} disabled={busy}><Pencil size={14}/>{l('Edit', 'Modifier')}</button><Link href={`/fabricants/${value.id}`} target="_blank" rel="noopener noreferrer" className="cat-icon-button" aria-label={l('Open public company page', 'Ouvrir la page publique du fabricant')}><ExternalLink size={16}/></Link><button type="button" className="cat-icon-button" disabled={busy || loading} onClick={() => void visibility(value, 'company')} aria-label={value.published ? l('Hide company', 'Masquer le fabricant') : l('Republish company', 'Republier le fabricant')} title={value.published ? l('Hide company', 'Masquer le fabricant') : l('Republish company', 'Republier le fabricant')}>{value.published ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></td></tr>;}) : filteredProducts.map(value => {const company = companyMap.get(value.companyId); const research = productResearch(value.specifications); const commerce = research?.commercial; return <tr key={value.id}><td><button type="button" className="cat-record-name" onClick={() => openDraft(productDraft(value, company))}>{value.name}</button><span className="cat-cell-sub">{categoryName(value.category)}</span>{value.reference && <span className="cat-record-code">{value.reference}</span>}</td><td><strong className="cat-cell-company">{company?.name || l('Company unavailable', 'Fabricant indisponible')}</strong><span className="cat-cell-sub">{company ? countryName(company.country) : ''}</span></td><td><span className="cat-commercial-value">{commerce?.price_min != null ? `${commerce.price_min}${commerce.price_max != null && commerce.price_max !== commerce.price_min ? `–${commerce.price_max}` : ''} ${commerce.currency || ''}${commerce.unit ? ` / ${commerce.unit}` : ''}` : commerce?.price_max != null ? `${commerce.price_max} ${commerce.currency || ''}${commerce.unit ? ` / ${commerce.unit}` : ''}` : l('Price not provided', 'Prix non communiqué')}</span><span className="cat-cell-sub">{l('MOQ', 'Qté mini.')} : {commerce?.moq ?? l('Not provided', 'Non communiquée')}</span>{typeof commerce?.minimum_price_quantity === 'number' && <span className="cat-cell-sub">{l('Minimum price from', 'Prix minimum dès')} {commerce.minimum_price_quantity} {commerce.unit}</span>}{typeof commerce?.availability === 'string' && <span className="cat-cell-sub">{commerce.availability}</span>}{commerce?.status && <span className="cat-cell-sub">{commerce.status}</span>}</td><td><span className={'cat-status ' + (value.published && company?.published ? 'cat-status-published' : '')}>{value.published && company?.published ? <Eye size={13}/> : <EyeOff size={13}/>} {value.published ? company?.published ? l('Published', 'Publié') : l('Company hidden', 'Fabricant masqué') : l('Hidden', 'Masqué')}</span>{research && <span className="cat-cell-sub">{l('Checked', 'Vérifié le')} {research.checkedAt.slice(0, 10)}</span>}</td><td><div className="cat-row-actions"><button type="button" className="cat-button cat-button-small" onClick={() => openDraft(productDraft(value, company))} disabled={busy}><Pencil size={14}/>{l('Edit', 'Modifier')}</button><Link href={`/produits/${value.id}`} target="_blank" rel="noopener noreferrer" className="cat-icon-button" aria-label={l('Open public product page', 'Ouvrir la page publique du produit')}><ExternalLink size={16}/></Link><button type="button" className="cat-icon-button" disabled={busy || loading} onClick={() => void visibility(value, 'product')} aria-label={value.published ? l('Hide product', 'Masquer le produit') : l('Republish product', 'Republier le produit')} title={value.published ? l('Hide product', 'Masquer le produit') : l('Republish product', 'Republier le produit')}>{value.published ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></td></tr>;})}
          </tbody></table>{rowsCount === 0 && <div className="cat-no-results"><Search size={27}/><h3>{l('No matching records', 'Aucune fiche correspondante')}</h3><p>{l('Try another search or reset the filters.', 'Essayez une autre recherche ou réinitialisez les filtres.')}</p></div>}</div>
        </section>}
      </>}
      <footer className="cat-page-footer"><ShieldCheck size={14}/>{l('Owner access · Two-factor authentication · Versioned changes', 'Accès propriétaires · Double authentification · Modifications versionnées')}</footer>
    </main>
  </div>;
}
