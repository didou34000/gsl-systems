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
  maintenanceOwner?:string;
  status?:'active'|'needs_review';
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

const additionalPacks:Record<string,CountryRequirements>={
 PL:{...base,countryCode:'PL',version:'2026-09-29.3',researchedAt:'2026-09-29',reviewMode:'manual_country_review',registryName:'KRS / CEIDG',registryUrl:'https://biznes.gov.pl/en',sources:['https://biznes.gov.pl/en','https://www.gov.pl/web/sprawiedliwosc/ogolne-informacje-o-prowadzeniu-dzialalnosci-gospodarczej-w-polsce'],fields:[field('registry_authority','Applicable register: KRS or CEIDG','Registre applicable : KRS ou CEIDG',true),field('registry_identifier','KRS reference, if applicable','Référence KRS, si applicable',false,['company']),field('ceidg_entry','Reference to the CEIDG entry, if applicable','Référence de l’inscription CEIDG, si applicable',false,['sole_trader','other']),field('vat_number','Business VAT number, if applicable','Numéro de TVA professionnel, si applicable',false,['company'])],evidence:label('An extract from the applicable register or an explanation of the entity’s specific situation.','Extrait du registre adapté ou explication de la situation particulière de l’entité.'),note:label('KRS and CEIDG cover different entity situations. A sole trader is not required to invent a KRS number. Registration evidence and VAT status are separate.','KRS et CEIDG correspondent à des situations juridiques différentes. Un entrepreneur individuel n’a pas à inventer un numéro KRS. Immatriculation et TVA restent distinctes.')},
 ES:{...base,countryCode:'ES',version:'2026-09-29.3',researchedAt:'2026-09-29',reviewMode:'manual_country_review',registryName:'Registro Mercantil',registryUrl:'https://www.registradores.org/en/informacion-al-ciudadano/servicion-on-line',sources:['https://www.registradores.org/en/informacion-al-ciudadano/servicion-on-line'],fields:[field('registry_authority','Issuing Mercantile Registry','Registre du commerce émetteur'),field('registry_identifier','Reference shown on the registry evidence','Référence figurant sur le justificatif'),field('registry_document_type','Information note, certification or other evidence','Note informative, certification ou autre justificatif'),field('corporate_tax_identifier','Company tax identifier, if applicable','Identifiant fiscal de la société, si applicable',false,['company'])],evidence:label('Registry evidence identifying the issuing register, entity and date; explain when not applicable.','Justificatif précisant le registre émetteur, l’entité et la date ; expliquer si non applicable.'),note:label('An information note and an official registry certification are different documents. Neither certifies manufactured products.','Une note informative et une certification officielle du registre sont des documents différents. Aucune ne certifie les produits fabriqués.')},

 GB:{...base,countryCode:'GB',version:'2026-09-29.2',researchedAt:'2026-09-29',reviewMode:'manual_country_review',registryName:'Companies House',registryUrl:'https://find-and-update.company-information.service.gov.uk/',sources:['https://www.gov.uk/guidance/searching-the-companies-house-register'],fields:[field('company_number','Companies House number, if registered','Numéro Companies House, si immatriculée',false,['company']),field('registry_jurisdiction','Registration jurisdiction','Juridiction d’immatriculation'),field('vat_number','VAT number, if applicable','Numéro de TVA, si applicable')],evidence:label('Registration extract or equivalent evidence appropriate to the entity; explain when Companies House registration does not apply.','Extrait ou preuve adaptée à l’entité ; expliquer si Companies House ne s’applique pas.'),note:label('Registration and a filed document do not certify the factory or the accuracy of all declarations. Tax identifiers are separate.','L’immatriculation et les documents déposés ne certifient ni l’usine ni toutes les déclarations. Les identifiants fiscaux sont distincts.')},
 DE:{...base,countryCode:'DE',version:'2026-09-29.2',researchedAt:'2026-09-29',reviewMode:'manual_country_review',registryName:'Registerportal der Länder',registryUrl:'https://www.handelsregister.de/rp_web/welcome.xhtml',sources:['https://www.handelsregister.de/rp_web/welcome.xhtml'],fields:[field('registry_court','Register authority / court','Autorité / tribunal du registre'),field('register_type','Register type shown on the extract','Type de registre figurant sur l’extrait'),field('registry_identifier','Registration reference, if applicable','Référence d’immatriculation, si applicable'),field('vat_number','VAT number, if applicable','Numéro de TVA, si applicable')],evidence:label('A current extract or alternative evidence appropriate to the register and legal form.','Extrait à jour ou preuve alternative adaptée au registre et à la forme juridique.'),note:label('A register reference needs its issuing authority. VAT alone is not registration evidence. The reviewer determines the applicable register.','Une référence de registre nécessite son autorité émettrice. La TVA seule n’est pas un justificatif d’immatriculation. Le contrôleur détermine le registre applicable.')},
 IT:{...base,countryCode:'IT',version:'2026-09-29.2',researchedAt:'2026-09-29',reviewMode:'manual_country_review',registryName:'Registro Imprese',registryUrl:'https://italianbusinessregister.it/en/home',sources:['https://italianbusinessregister.it/en/home'],fields:[field('registry_authority','Registration authority / Chamber of Commerce','Autorité du registre / chambre de commerce'),field('registry_identifier','Reference shown on the business extract','Référence figurant sur l’extrait'),field('corporate_tax_identifier','Company fiscal code, if applicable','Code fiscal de la société, si applicable',false,['company']),field('vat_number','VAT number, if applicable','Numéro de TVA, si applicable')],evidence:label('Business register extract appropriate to the entity. Keep references as printed and identify the issuing authority.','Extrait du registre adapté à l’entité. Conserver les références imprimées et identifier l’autorité émettrice.'),note:label('Register information, fiscal code and VAT are separate fields. Availability or cost of an official extract is not guaranteed.','Registre, code fiscal et TVA sont des champs distincts. L’accès ou la gratuité d’un extrait officiel ne sont pas garantis.')},
 US:{...base,countryCode:'US',version:'2026-09-29.2',researchedAt:'2026-09-29',reviewMode:'manual_country_review',registryName:'Registration authority of the formation jurisdiction',registryUrl:'https://www.sba.gov/counseling/launch-your-business/',sources:['https://www.sba.gov/counseling/launch-your-business/'],fields:[field('formation_jurisdiction','State / jurisdiction of formation','État / juridiction de constitution',true,['company']),field('registry_authority','Registration authority, if applicable','Autorité d’immatriculation, si applicable'),field('registry_identifier','Entity registration number, if applicable','Numéro d’immatriculation de l’entité, si applicable')],evidence:label('Formation or registration evidence from the appropriate jurisdiction, or an explanation if registration does not apply.','Preuve de constitution ou d’immatriculation de la juridiction adaptée, ou explication si non applicable.'),note:label('There is no single universal company registration number for this form. GSL does not require an EIN or personal tax identifier by default.','Ce formulaire n’impose pas de numéro universel d’entreprise. GSL ne demande ni EIN ni identifiant fiscal personnel par défaut.')},
};

function countryPack(code: string): CountryRequirements {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Use an ISO 3166-1 alpha-2 country code.');
  // Validate against the full country selector on submission; never invent local requirements.
  return countryRequirements[normalized] ?? additionalPacks[normalized] ?? {
    ...base, countryCode: normalized, registryName: '', registryUrl: '', sources: [],
    reviewMode: 'manual_country_review', researchedAt: '',
    fields: [field('registry_name', 'Business registry authority', 'Autorité du registre des entreprises', true), field('registry_identifier', 'Business registry identifier', 'Identifiant au registre des entreprises', true, ['company'])],
    evidence: label('Official business registration evidence, reviewed for the country and legal form.', 'Justificatif officiel d’immatriculation, examiné selon le pays et la forme juridique.'),
    note: label('This country has no researched template yet. A reviewer must establish the appropriate requirements before approving the profile.', 'Ce pays n’a pas encore de fiche documentée. Un contrôleur doit déterminer les exigences adaptées avant de valider le profil.'),
  };
}

export function getCountryRequirements(code:string):CountryRequirements{const pack=countryPack(code);return {...pack,maintenanceOwner:'GSL systems — Dorian Vuattoux et Célian Duval',status:['FR','TR'].includes(pack.countryCode)?'active':'needs_review',fields:[...pack.fields,field('registration_explanation','If registration evidence or an identifier does not apply, explain why','Si un justificatif ou identifiant ne s’applique pas, expliquez pourquoi')]};}

/** Completeness is deliberately NOT verification, authenticity or permission to publish. */
export function assessCountryDetails(code: string, entityKind: EntityKind, values: Record<string, string>) {
  const pack = getCountryRequirements(code);
  const fields = pack.fields.filter(f => f.appliesTo.includes(entityKind));
  const hasExplanation=(values.registration_explanation||'').trim().length>=20;
  const missing = fields.filter(f => f.requirement === 'review_required' && !values[f.key]?.trim()&&!hasExplanation).map(f => f.key);
  const unexpected = Object.keys(values).filter(key => !fields.some(f => f.key === key));
  return { version: pack.version, missing, unexpected, complete: missing.length === 0 && unexpected.length === 0,
    verificationStatus: 'unverified' as const,
    manualReviewRequired: hasExplanation || pack.reviewMode === 'manual_country_review' || entityKind !== 'company',
  };
}
