/** Researched onboarding templates, not an assertion of legal compliance.
 * Required fields below are GSL's review policy, not universal legal obligations.
 * A completed form always needs a separate, evidenced review.
 */
export type LocalLabel = { en: string; fr: string };
export type EntityKind = 'company' | 'sole_trader' | 'other';
export type CountryField = {
  key: string;
  label: LocalLabel;
  requirement: 'review_required' | 'if_applicable';
  appliesTo: EntityKind[];
  visibility: 'private';
};
export type CountryRequirements = {
  countryCode: string;
  version: string;
  researchedAt: string;
  registryName: string;
  registryUrl: string;
  sources: string[];
  fields: CountryField[];
  evidence: LocalLabel;
  note: LocalLabel;
  reviewMode: 'document_review' | 'manual_country_review';
};

const label = (en: string, fr: string): LocalLabel => ({ en, fr });
const field = (key: string, en: string, fr: string, required = false, appliesTo: EntityKind[] = ['company', 'sole_trader', 'other']): CountryField => ({
  key, label: label(en, fr), requirement: required ? 'review_required' : 'if_applicable', appliesTo, visibility: 'private',
});
const base = { version: '2026-09-25.1', researchedAt: '2026-09-25', reviewMode: 'document_review' as const };

export const countryRequirements: Readonly<Record<string, CountryRequirements>> = {
  TR: {
    ...base, countryCode: 'TR', registryName: 'MERSİS / Ticaret Sicili', registryUrl: 'https://mersis.ticaret.gov.tr/',
    sources: ['https://ticaret.gov.tr/ic-ticaret/ticaret-sicili/merkezi-sicil-kayit-sistemi-mersis', 'https://ticaret.gov.tr/ic-ticaret/sikca-sorulan-sorular/ticaret-sicili'],
    fields: [field('mersis', 'MERSİS number', 'Numéro MERSİS', true, ['company']), field('trade_registry_number', 'Trade registry number', 'Numéro du registre du commerce', true, ['company']), field('trade_registry_office', 'Trade registry office', 'Bureau du registre du commerce', true, ['company']), field('tax_number', 'Corporate tax number', 'Numéro fiscal de la société', false, ['company']), field('tax_office', 'Tax office', 'Bureau fiscal')],
    evidence: label('Current trade registry extract or registration document; latest relevant registry gazette notice if needed.', 'Extrait ou justificatif du registre du commerce à jour ; dernière annonce pertinente du registre si nécessaire.'),
    note: label('Sole traders and other legal forms need manual review. Do not upload a personal identity number into these company fields.', 'Les entrepreneurs individuels et autres formes passent en revue manuelle. Ne pas saisir de numéro d’identité personnel dans les champs de société.'),
  },
  GE: {
    ...base, countryCode: 'GE', registryName: 'National Agency of Public Registry (NAPR)', registryUrl: 'https://napr.gov.ge/en',
    sources: ['https://napr.gov.ge/en/page/frequently-asked-questions', 'https://www.napr.gov.ge/en/page/frequently-asked-questions/economic-activity'],
    fields: [field('identification_code', 'Company identification code', 'Code d’identification de la société', true, ['company']), field('registration_date', 'Registration date shown on the extract', 'Date d’immatriculation figurant sur l’extrait'), field('registered_status', 'Status shown on the extract', 'Statut figurant sur l’extrait')],
    evidence: label('Current NAPR business registry extract identifying the entity, its registered address and representatives.', 'Extrait à jour du registre des entreprises NAPR identifiant l’entité, son siège et ses représentants.'),
    note: label('Keep the registered office separate from the factory. Economic activity registration is not universally mandatory. Sole traders require private manual review.', 'Séparer le siège de l’usine. L’inscription au registre des activités économiques n’est pas obligatoire pour toutes les entreprises. Revue privée spécifique pour les entrepreneurs individuels.'),
  },
  MA: {
    ...base, countryCode: 'MA', registryName: 'OMPIC / Registre du commerce', registryUrl: 'https://www.directinfo.ma/',
    sources: ['https://www.ompic.ma/en/content/central-trade-register/forms', 'https://rbe.ompic.ma/assets/doc/Formulaire%20de%20la%20demande.pdf'],
    fields: [field('ice', 'Common company identifier (ICE)', 'Identifiant commun de l’entreprise (ICE)', true, ['company']), field('trade_registry_number', 'Trade register number (RC)', 'Numéro du registre du commerce (RC)', true, ['company']), field('registry_court', 'Registry court', 'Tribunal du registre', true, ['company']), field('tax_number', 'Company tax identifier', 'Identifiant fiscal de la société', false, ['company'])],
    evidence: label('Registration certificate or current trade register extract; confirm RC together with its registry court.', 'Certificat d’immatriculation ou extrait à jour du registre du commerce ; contrôler le RC avec son tribunal.'),
    note: label('A name reservation certificate is not proof that the company is registered. The requested documents follow GSL review policy.', 'Un certificat négatif de réservation de nom ne prouve pas l’immatriculation. Les pièces demandées relèvent de la politique de revue GSL.'),
  },
  TN: {
    ...base, countryCode: 'TN', registryName: 'Registre national des entreprises (RNE)', registryUrl: 'https://www.registre-entreprises.tn/',
    sources: ['https://www.registre-entreprises.tn/', 'https://home.registre-entreprises.tn/formalites/'],
    fields: [field('registry_identifier', 'Identifier shown on the RNE extract', 'Identifiant figurant sur l’extrait RNE', true, ['company']), field('tax_number', 'Company tax identifier, if applicable', 'Matricule fiscal de la société, le cas échéant', false, ['company'])],
    evidence: label('Current RNE extract; use the official extract authenticity verification service.', 'Extrait RNE à jour ; utiliser le service officiel de vérification de l’authenticité de l’extrait.'),
    note: label('Preserve the identifier exactly as printed. Do not infer a tax or VAT status from registration alone.', 'Conserver l’identifiant tel qu’il figure sur l’extrait. Ne pas déduire un statut fiscal ou de TVA de la seule immatriculation.'),
  },
  FR: {
    ...base, countryCode: 'FR', registryName: 'RNE / INPI', registryUrl: 'https://data.inpi.fr/',
    sources: ['https://entreprendre.service-public.gouv.fr/vosdroits/R19859', 'https://www.entreprises.gouv.fr/la-dge/actualites/attestation-dimmatriculation-au-registre-national-des-entreprises-ou-extrait-rne'],
    fields: [field('siren', 'SIREN — company identifier', 'SIREN — identifiant de l’entreprise', true), field('headquarters_siret', 'Registered office SIRET', 'SIRET de l’établissement siège'), field('vat_number', 'VAT number, if applicable', 'Numéro de TVA, si applicable')],
    evidence: label('RNE registration attestation; a current Kbis may also be provided where applicable.', 'Attestation d’immatriculation au RNE ; un extrait Kbis à jour peut également être fourni si applicable.'),
    note: label('The SIREN identifies the entity; each establishment has its own SIRET. VAT eligibility needs a separate check.', 'Le SIREN identifie l’entité ; chaque établissement possède son SIRET. Le statut TVA nécessite un contrôle distinct.'),
  },
};

export function getCountryRequirements(code: string): CountryRequirements {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Use an ISO 3166-1 alpha-2 country code.');
  // Validate against the full country selector on submission; never invent local requirements.
  return countryRequirements[normalized] ?? {
    ...base, countryCode: normalized, registryName: '', registryUrl: '', sources: [],
    reviewMode: 'manual_country_review', researchedAt: '',
    fields: [field('registry_name', 'Business registry authority', 'Autorité du registre des entreprises', true), field('registry_identifier', 'Business registry identifier', 'Identifiant au registre des entreprises', true, ['company'])],
    evidence: label('Official business registration evidence, reviewed for the country and legal form.', 'Justificatif officiel d’immatriculation, examiné selon le pays et la forme juridique.'),
    note: label('This country has no researched template yet. A reviewer must establish the appropriate requirements before approving the profile.', 'Ce pays n’a pas encore de fiche documentée. Un contrôleur doit déterminer les exigences adaptées avant de valider le profil.'),
  };
}

/** Completeness is deliberately NOT verification, authenticity or permission to publish. */
export function assessCountryDetails(code: string, entityKind: EntityKind, values: Record<string, string>) {
  const pack = getCountryRequirements(code);
  const fields = pack.fields.filter(f => f.appliesTo.includes(entityKind));
  const missing = fields.filter(f => f.requirement === 'review_required' && !values[f.key]?.trim()).map(f => f.key);
  const unexpected = Object.keys(values).filter(key => !fields.some(f => f.key === key));
  return { version: pack.version, missing, unexpected, complete: missing.length === 0 && unexpected.length === 0,
    verificationStatus: 'unverified' as const,
    manualReviewRequired: pack.reviewMode === 'manual_country_review' || entityKind !== 'company',
  };
}
