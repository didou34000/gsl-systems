/** Public, source-attributed editorial content. Supplier contact details never belong here. */
export type ResearchSource = {url: string; title: string; supports?: string};
export type TradeAgreement = {
  code: string; agreement: string; date: string; benefit: string; proof: string; limits: string;
  sources: ResearchSource[];
};
export type ResearchRule = {
  id: string; type: string; title: string; scope: string; requirements: string; limits: string;
  sources: ResearchSource[];
};
export type CompanyResearch = {
  kind: 'gsl_research'; schemaVersion: 1; sourceId: string; checkedAt: string;
  sector: string; family: string; categories: string[]; productFamilies: string; processes: string;
  certifications: string; certificationStatus: string; certificationDates: string;
  evidenceLevel: 'D' | 'R' | 'F' | 'H' | 'N'; europeanMarket: string;
  agreement: TradeAgreement; regulations: ResearchRule[]; sources: ResearchSource[];
};
export type ProductCommercial = {
  price_min: number | null; price_max: number | null; currency: string | null; unit: string | null;
  moq: number | string | null; lead_time: string | null; terms: string | null; status: string;
  [key: string]: unknown;
};
export type ProductResearch = {
  kind: 'gsl_research'; schemaVersion: 1; sourceId: string; checkedAt: string;
  specifications: Record<string, string>; applications: string[]; materials: string[];
  customization: string | null; commercial: ProductCommercial; sources: ResearchSource[];
  companySourceId: string; scopeNote?: string;
};
export const researchCategories = [
  {id: 'usinage-precision', en: 'Precision machining', fr: 'Usinage de précision', group: 'metal'},
  {id: 'tolerie-soudage', en: 'Sheet metal & welding', fr: 'Tôlerie et soudage', group: 'metal'},
  {id: 'fonderie-forge', en: 'Casting & forging', fr: 'Fonderie et forge', group: 'metal'},
  {id: 'aluminium-extrusion', en: 'Aluminium & extrusion', fr: 'Aluminium et extrusion', group: 'metal'},
  {id: 'roulements-transmission', en: 'Bearings & transmission', fr: 'Roulements et transmission', group: 'metal'},
  {id: 'pompes-hydraulique', en: 'Pumps & hydraulics', fr: 'Pompes et hydraulique', group: 'machines'},
  {id: 'ressorts-fixations', en: 'Springs & fasteners', fr: 'Ressorts et fixations', group: 'metal'},
  {id: 'moules-injection', en: 'Moulds, tooling & injection', fr: 'Moules, outillages et injection', group: 'plasturgie'},
  {id: 'manutention-industrielle', en: 'Industrial handling', fr: 'Manutention industrielle', group: 'machines'},
  {id: 'cables-electriques', en: 'Electrical cables', fr: 'Câbles électriques', group: 'electricite'},
  {id: 'faisceaux-cablage', en: 'Harnesses & cable assemblies', fr: 'Faisceaux et câblage', group: 'electricite'},
  {id: 'electronique-capteurs', en: 'Electronics & sensors', fr: 'Électronique et capteurs', group: 'electricite'},
  {id: 'energie-transformateurs', en: 'Energy & transformers', fr: 'Énergie et transformateurs', group: 'electricite'},
  {id: 'automatismes-appareillage', en: 'Controls & switchgear', fr: 'Automatismes et appareillage', group: 'electricite'},
  {id: 'acier-construction', en: 'Steel & construction', fr: 'Acier et construction', group: 'construction'},
  {id: 'elastomeres-etancheite', en: 'Elastomers & sealing', fr: 'Élastomères et étanchéité', group: 'plasturgie'},
] as const;

export function companyResearch(details: unknown): CompanyResearch | null {
  if (!details || typeof details !== 'object') return null;
  const value = (details as {research?: unknown}).research;
  if (!value || typeof value !== 'object') return null;
  const research = value as CompanyResearch;
  return research.kind === 'gsl_research' && research.schemaVersion === 1 && Array.isArray(research.sources) ? research : null;
}

/** Existing catalogue specifications are string-valued; the versioned document preserves that contract. */
export function productResearch(specifications: Record<string, string> | undefined): ProductResearch | null {
  if (!specifications?.research_data) return null;
  try {
    const value = JSON.parse(specifications.research_data) as ProductResearch;
    return value.kind === 'gsl_research' && value.schemaVersion === 1 && Array.isArray(value.sources) && value.commercial ? value : null;
  } catch {return null;}
}

export function safeSourceUrl(value: string): string | null {
  try {const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;} catch {return null;}
}
