/**
 * Declarative technical fields for supplier products, by product family.
 *
 * One schema drives the supplier form (lib → app/supplier-products.tsx), the server
 * validation (productPublicationIssues in lib/onboarding/supplier-profile.ts) and the
 * public rendering (publishedSpecificationRows below).
 *
 * Storage
 * - Private draft: supplier_applications.payload.products[] keeps `family` (one of the
 *   family ids below) and `specs` (Record<field key, string>), the source of truth.
 * - Publication: the existing RPC publish_supplier_products whitelists specification keys
 *   (materials, processes, reference, lead_time, minimum_quantity, unit…, 250 characters
 *   each) and keeps `description` (up to 5,000 characters). The family and the technical
 *   values are therefore appended to the published description as a fixed, readable block
 *   (composePublishedDescription). publishedSpecificationRows() parses that block back
 *   into labelled rows with units and returns the description without it.
 *   The public category stays one of the RPC's accepted categories (categoryForFamily).
 *
 * Family ids are those of roboticsFamilies in lib/robotics.ts, plus `autre`.
 * This module has no imports so it can be compiled alone by the test scripts.
 */

export type SpecOption = {value: string; en: string; fr: string};
export type SpecField = {
  key: string;
  en: string;
  fr: string;
  type: 'number' | 'text' | 'select';
  /** International unit symbol; unitFr only where French differs. */
  unit?: string;
  unitFr?: string;
  options?: readonly SpecOption[];
  /** Required for every kind, or only for the listed kinds. */
  required?: boolean | readonly string[];
  /** Field shown only for these kinds (values of the family's `kind` field). */
  kinds?: readonly string[];
  suggestions?: readonly string[];
  placeholder?: string;
  hintEn?: string;
  hintFr?: string;
  max?: number;
  /** Numbers may be negative (never used for magnitudes). */
  signed?: boolean;
};
export type ProductFamily = {
  id: string;
  en: string;
  fr: string;
  /** Category accepted by publish_supplier_products. */
  category: string;
  /** Category override for some kinds (e.g. moulded parts are plastics). */
  kindCategory?: Record<string, string>;
  fields: readonly SpecField[];
};

export const KIND_KEY = 'kind';
export const COMPATIBILITY_KEY = 'compatibility';
/** Units accepted platform-wide for quantities (buyer requests use the same list). */
export const quantityUnits = ['pcs', 'set', 'kg', 'm', 'm2'] as const;
export const quantityUnitLabels: Record<string, {en: string; fr: string}> = {
  pcs: {en: 'pieces', fr: 'pièces'},
  set: {en: 'sets', fr: 'ensembles'},
  kg: {en: 'kg', fr: 'kg'},
  m: {en: 'metres', fr: 'mètres'},
  m2: {en: 'm²', fr: 'm²'},
};
/** Legacy general categories, still selectable for the "Other component" family. */
export const legacyCategories: readonly SpecOption[] = [
  {value: 'metal', en: 'Machining & metal parts', fr: 'Usinage et pièces métalliques'},
  {value: 'machines', en: 'Machinery', fr: 'Machines'},
  {value: 'electricite', en: 'Electrical equipment', fr: 'Équipements électriques'},
  {value: 'plasturgie', en: 'Plastics & moulding', fr: 'Plasturgie et moulage'},
  {value: 'construction', en: 'Construction products', fr: 'Produits de construction'},
  {value: 'textile', en: 'Textiles', fr: 'Textiles'},
  {value: 'emballage', en: 'Packaging', fr: 'Emballage'},
  {value: 'mobilier', en: 'Professional furniture', fr: 'Mobilier professionnel'},
  {value: 'other', en: 'Other', fr: 'Autre'},
];

const kind = (options: SpecOption[]): SpecField => ({key: KIND_KEY, en: 'Type', fr: 'Type', type: 'select', options, required: true});
const n = (key: string, en: string, fr: string, unit: string | undefined, extra: Partial<SpecField> = {}): SpecField => ({key, en, fr, type: 'number', unit, ...extra});
const t = (key: string, en: string, fr: string, extra: Partial<SpecField> = {}): SpecField => ({key, en, fr, type: 'text', ...extra});

const interfaces = ['CAN', 'CAN FD', 'CANopen', 'EtherCAT', 'RS-485', 'Modbus RTU', 'UART', 'SPI', 'I²C', 'USB', 'Ethernet', 'PWM', 'BiSS-C', 'SSI'];
const ipRatings = ['IP40', 'IP54', 'IP65', 'IP66', 'IP67', 'IP68'];
const weight = n('weight_kg', 'Weight', 'Masse', 'kg');
const dimensions = t('dimensions_mm', 'Dimensions', 'Dimensions', {unit: 'mm', placeholder: 'Ø 80 × 60', hintEn: 'Diameter × length, or length × width × height.', hintFr: 'Diamètre × longueur, ou longueur × largeur × hauteur.'});
const ip = t('ip_rating', 'Protection rating', 'Indice de protection', {suggestions: ipRatings, max: 20});
const temperature = t('operating_temperature', 'Operating temperature', 'Température de fonctionnement', {unit: '°C', placeholder: '-20 / +60', max: 40});
const communication = t('interface', 'Communication interface', 'Interface de communication', {suggestions: interfaces, placeholder: 'CAN FD, EtherCAT'});
export const compatibilityField: SpecField = t(COMPATIBILITY_KEY, 'Compatible with', 'Compatible avec', {
  max: 500,
  placeholder: 'Unitree H1 knee joint, ISO 9409-1-50 flange…',
  hintEn: 'Robots, joints, assemblies, standards or parts this product fits.',
  hintFr: 'Robots, articulations, ensembles, normes ou pièces auxquels ce produit s’adapte.',
});

const ROTARY = ['rotary_actuator', 'motor', 'servo'];
const REDUCERS = ['harmonic', 'planetary', 'cycloidal'];

export const productFamilies: readonly ProductFamily[] = [
  {
    id: 'actionnement-transmission', en: 'Motors, servos & actuators', fr: 'Moteurs, servomoteurs et actionneurs', category: 'electricite',
    fields: [
      kind([
        {value: 'rotary_actuator', en: 'Integrated rotary actuator', fr: 'Actionneur rotatif intégré'},
        {value: 'linear_actuator', en: 'Linear actuator', fr: 'Actionneur linéaire'},
        {value: 'motor', en: 'Motor (BLDC, frameless, stepper)', fr: 'Moteur (BLDC, sans cadre, pas à pas)'},
        {value: 'servo', en: 'Servo motor', fr: 'Servomoteur'},
      ]),
      n('torque_nm', 'Rated torque', 'Couple nominal', 'N·m', {kinds: ROTARY, required: ROTARY}),
      n('peak_torque_nm', 'Peak torque', 'Couple crête', 'N·m', {kinds: ROTARY}),
      n('speed_rpm', 'Rated speed', 'Vitesse nominale', 'rpm', {unitFr: 'tr/min', kinds: ROTARY}),
      n('force_n', 'Rated force', 'Force nominale', 'N', {kinds: ['linear_actuator'], required: ['linear_actuator']}),
      n('peak_force_n', 'Peak force', 'Force crête', 'N', {kinds: ['linear_actuator']}),
      n('stroke_mm', 'Stroke', 'Course', 'mm', {kinds: ['linear_actuator'], required: ['linear_actuator']}),
      n('linear_speed_mm_s', 'Maximum speed', 'Vitesse maximale', 'mm/s', {kinds: ['linear_actuator']}),
      n('voltage_v', 'Rated voltage', 'Tension nominale', 'V', {required: true}),
      n('power_w', 'Rated power', 'Puissance nominale', 'W'),
      n('current_a', 'Rated current', 'Courant nominal', 'A'),
      n('gear_ratio', 'Gear ratio', 'Rapport de réduction', ':1', {kinds: ['rotary_actuator', 'linear_actuator', 'servo']}),
      n('backlash_arcmin', 'Backlash', 'Jeu mécanique', 'arcmin', {kinds: ['rotary_actuator', 'servo']}),
      t('encoder', 'Encoder', 'Codeur', {placeholder: 'Absolute 17-bit, dual encoder'}),
      communication, weight, dimensions, ip,
    ],
  },
  {
    id: 'transmissions-guidages', en: 'Reducers, transmission & guidance', fr: 'Réducteurs, transmissions et guidages', category: 'metal',
    fields: [
      kind([
        {value: 'harmonic', en: 'Strain wave (harmonic) reducer', fr: 'Réducteur à onde de déformation'},
        {value: 'planetary', en: 'Planetary reducer', fr: 'Réducteur planétaire'},
        {value: 'cycloidal', en: 'Cycloidal reducer', fr: 'Réducteur cycloïdal'},
        {value: 'screw', en: 'Ball or roller screw', fr: 'Vis à billes ou à rouleaux'},
        {value: 'bearing', en: 'Bearing', fr: 'Roulement'},
        {value: 'linear_guide', en: 'Linear guide', fr: 'Guidage linéaire'},
      ]),
      n('reduction_ratio', 'Reduction ratio', 'Rapport de réduction', ':1', {kinds: REDUCERS, required: REDUCERS}),
      n('torque_nm', 'Rated torque', 'Couple nominal', 'N·m', {kinds: REDUCERS, required: REDUCERS}),
      n('peak_torque_nm', 'Peak torque', 'Couple crête', 'N·m', {kinds: REDUCERS}),
      n('backlash_arcmin', 'Backlash', 'Jeu mécanique', 'arcmin', {kinds: REDUCERS}),
      n('stiffness_nm_arcmin', 'Torsional stiffness', 'Rigidité en torsion', 'N·m/arcmin', {kinds: REDUCERS}),
      n('efficiency_pct', 'Efficiency', 'Rendement', '%', {kinds: REDUCERS}),
      n('input_speed_rpm', 'Maximum input speed', 'Vitesse d’entrée maximale', 'rpm', {unitFr: 'tr/min', kinds: REDUCERS}),
      n('lead_mm', 'Lead', 'Pas', 'mm', {kinds: ['screw'], required: ['screw']}),
      n('nominal_diameter_mm', 'Nominal diameter', 'Diamètre nominal', 'mm', {kinds: ['screw', 'bearing']}),
      n('dynamic_load_kn', 'Dynamic load rating', 'Charge dynamique de base', 'kN', {kinds: ['screw', 'bearing', 'linear_guide'], required: ['bearing', 'linear_guide']}),
      n('static_load_kn', 'Static load rating', 'Charge statique de base', 'kN', {kinds: ['screw', 'bearing', 'linear_guide']}),
      t('accuracy_class', 'Accuracy class', 'Classe de précision', {kinds: ['screw', 'bearing', 'linear_guide'], max: 40}),
      n('length_mm', 'Length', 'Longueur', 'mm', {kinds: ['screw', 'linear_guide']}),
      weight, dimensions,
    ],
  },
  {
    id: 'capteurs-vision', en: 'Sensors & vision', fr: 'Capteurs et systèmes de vision', category: 'electricite',
    fields: [
      kind([
        {value: 'encoder', en: 'Encoder', fr: 'Codeur'},
        {value: 'force_torque', en: 'Force / torque sensor', fr: 'Capteur de force / couple'},
        {value: 'imu', en: 'Inertial measurement unit (IMU)', fr: 'Centrale inertielle (IMU)'},
        {value: 'camera', en: 'Camera (2D / 3D vision)', fr: 'Caméra (vision 2D / 3D)'},
        {value: 'lidar', en: 'Lidar', fr: 'Lidar'},
        {value: 'tactile', en: 'Tactile sensor', fr: 'Capteur tactile'},
      ]),
      n('resolution_bits', 'Resolution', 'Résolution', 'bits', {kinds: ['encoder'], required: ['encoder']}),
      n('range_n', 'Force range', 'Plage de force', 'N', {kinds: ['force_torque', 'tactile'], required: ['force_torque']}),
      n('torque_range_nm', 'Torque range', 'Plage de couple', 'N·m', {kinds: ['force_torque']}),
      n('axes', 'Number of axes', 'Nombre d’axes', undefined, {kinds: ['force_torque', 'imu']}),
      t('image_resolution', 'Image resolution', 'Résolution d’image', {kinds: ['camera'], required: ['camera'], placeholder: '1280 × 720', max: 60}),
      n('field_of_view_deg', 'Field of view', 'Champ de vision', '°', {kinds: ['camera', 'lidar']}),
      n('depth_range_m', 'Measuring range', 'Portée de mesure', 'm', {kinds: ['camera', 'lidar'], required: ['lidar']}),
      t('accuracy', 'Accuracy', 'Précision', {placeholder: '±0.5 % FS', max: 60}),
      n('frequency_hz', 'Sampling or frame rate', 'Fréquence d’acquisition', 'Hz'),
      {...communication, required: true},
      n('voltage_v', 'Supply voltage', 'Tension d’alimentation', 'V'),
      ip, weight, dimensions,
    ],
  },
  {
    id: 'commande-electronique', en: 'Controllers & embedded electronics', fr: 'Cartes électroniques, contrôleurs et informatique embarquée', category: 'electricite',
    fields: [
      kind([
        {value: 'motor_driver', en: 'Motor driver', fr: 'Variateur / driver moteur'},
        {value: 'main_controller', en: 'Main controller / onboard computer', fr: 'Contrôleur principal / calculateur embarqué'},
        {value: 'io_board', en: 'I/O or interface board', fr: 'Carte d’entrées-sorties ou d’interface'},
        {value: 'custom_pcb', en: 'Custom PCB / PCBA', fr: 'Carte électronique sur mesure'},
      ]),
      n('voltage_v', 'Supply voltage', 'Tension d’alimentation', 'V', {required: true}),
      n('continuous_current_a', 'Continuous output current', 'Courant de sortie continu', 'A', {kinds: ['motor_driver'], required: ['motor_driver']}),
      n('peak_current_a', 'Peak current', 'Courant crête', 'A', {kinds: ['motor_driver']}),
      n('channels', 'Number of channels or axes', 'Nombre de voies ou d’axes', undefined, {kinds: ['motor_driver', 'io_board']}),
      n('control_frequency_khz', 'Control loop frequency', 'Fréquence de la boucle de régulation', 'kHz', {kinds: ['motor_driver', 'main_controller']}),
      t('processor', 'Processor', 'Processeur', {kinds: ['main_controller', 'custom_pcb'], required: ['main_controller'], max: 120}),
      n('compute_tops', 'AI compute', 'Puissance de calcul IA', 'TOPS', {kinds: ['main_controller']}),
      n('pcb_layers', 'PCB layers', 'Nombre de couches', undefined, {kinds: ['custom_pcb']}),
      {...communication, en: 'Interfaces', fr: 'Interfaces'},
      temperature, weight, dimensions,
    ],
  },
  {
    id: 'cables-connecteurs', en: 'Cables, connectors & harnesses', fr: 'Câbles, connecteurs et faisceaux', category: 'electricite',
    fields: [
      kind([
        {value: 'dynamic_cable', en: 'Dynamic cable', fr: 'Câble dynamique'},
        {value: 'harness', en: 'Cable harness', fr: 'Faisceau'},
        {value: 'connector', en: 'Connector', fr: 'Connecteur'},
        {value: 'slip_ring', en: 'Slip ring', fr: 'Collecteur tournant'},
      ]),
      n('conductors', 'Number of conductors', 'Nombre de conducteurs', undefined, {kinds: ['dynamic_cable', 'harness', 'slip_ring'], required: ['dynamic_cable', 'slip_ring']}),
      n('contacts', 'Number of contacts', 'Nombre de contacts', undefined, {kinds: ['connector'], required: ['connector']}),
      n('cross_section_mm2', 'Conductor cross-section', 'Section des conducteurs', 'mm²', {kinds: ['dynamic_cable', 'harness']}),
      n('voltage_v', 'Rated voltage', 'Tension nominale', 'V'),
      n('current_a', 'Rated current', 'Courant nominal', 'A'),
      n('length_mm', 'Length', 'Longueur', 'mm', {kinds: ['dynamic_cable', 'harness']}),
      n('flex_cycles', 'Flex life', 'Durée de vie en flexion', 'cycles', {kinds: ['dynamic_cable']}),
      n('bend_radius_mm', 'Minimum bend radius', 'Rayon de courbure minimal', 'mm', {kinds: ['dynamic_cable', 'harness']}),
      n('torsion_deg_m', 'Permissible torsion', 'Torsion admissible', '°/m', {kinds: ['dynamic_cable']}),
      t('connector_type', 'Connector type', 'Type de connecteur', {kinds: ['harness', 'connector'], placeholder: 'M8, M12, JST GH…', max: 120}),
      n('mating_cycles', 'Mating cycles', 'Cycles de connexion', 'cycles', {kinds: ['connector']}),
      t('shielding', 'Shielding', 'Blindage', {max: 120}),
      ip, temperature,
    ],
  },
  {
    id: 'energie-batteries', en: 'Batteries, power & energy management', fr: 'Batteries, alimentations et gestion de l’énergie', category: 'electricite',
    fields: [
      kind([
        {value: 'battery_pack', en: 'Battery pack', fr: 'Pack batterie'},
        {value: 'bms', en: 'Battery management system (BMS)', fr: 'Système de gestion de batterie (BMS)'},
        {value: 'charger', en: 'Charger', fr: 'Chargeur'},
        {value: 'power_supply', en: 'Power supply / DC-DC converter', fr: 'Alimentation / convertisseur DC-DC'},
      ]),
      t('chemistry', 'Cell chemistry', 'Chimie des cellules', {kinds: ['battery_pack'], required: ['battery_pack'], suggestions: ['Li-ion NMC', 'LFP', 'LTO', 'Li-Po'], max: 60}),
      n('voltage_v', 'Nominal voltage', 'Tension nominale', 'V', {required: true}),
      n('capacity_ah', 'Capacity', 'Capacité', 'Ah', {kinds: ['battery_pack'], required: ['battery_pack']}),
      n('energy_wh', 'Energy', 'Énergie', 'Wh', {kinds: ['battery_pack']}),
      n('continuous_current_a', 'Continuous current', 'Courant continu', 'A'),
      n('peak_current_a', 'Peak current', 'Courant crête', 'A'),
      n('power_w', 'Output power', 'Puissance de sortie', 'W', {kinds: ['charger', 'power_supply'], required: ['power_supply']}),
      t('cell_configuration', 'Cell configuration', 'Configuration des cellules', {kinds: ['battery_pack', 'bms'], placeholder: '14S4P', max: 40}),
      n('cycle_life', 'Cycle life', 'Durée de vie', 'cycles', {kinds: ['battery_pack']}),
      {key: 'un38_3', en: 'UN 38.3 transport test', fr: 'Essai de transport UN 38.3', type: 'select', kinds: ['battery_pack'], options: [
        {value: 'passed', en: 'Passed', fr: 'Réussi'},
        {value: 'in_progress', en: 'In progress', fr: 'En cours'},
        {value: 'not_tested', en: 'Not tested', fr: 'Non testé'},
      ]},
      communication, temperature, weight, dimensions,
    ],
  },
  {
    id: 'prehension', en: 'Grippers & tooling', fr: 'Préhenseurs et outils', category: 'machines',
    fields: [
      kind([
        {value: 'parallel_gripper', en: 'Parallel gripper', fr: 'Pince parallèle'},
        {value: 'dexterous_hand', en: 'Dexterous hand', fr: 'Main robotique'},
        {value: 'vacuum', en: 'Vacuum gripper', fr: 'Préhenseur à vide'},
        {value: 'tool_changer', en: 'Tool changer', fr: 'Changeur d’outil'},
      ]),
      n('payload_kg', 'Payload', 'Charge utile', 'kg', {required: true}),
      n('force_n', 'Gripping force', 'Force de préhension', 'N', {kinds: ['parallel_gripper', 'dexterous_hand']}),
      n('stroke_mm', 'Stroke', 'Course', 'mm', {kinds: ['parallel_gripper']}),
      n('dof', 'Degrees of freedom', 'Degrés de liberté', undefined, {kinds: ['dexterous_hand']}),
      n('closing_time_s', 'Closing time', 'Temps de fermeture', 's', {kinds: ['parallel_gripper', 'dexterous_hand']}),
      n('vacuum_kpa', 'Vacuum level', 'Niveau de vide', 'kPa', {kinds: ['vacuum']}),
      n('voltage_v', 'Supply voltage', 'Tension d’alimentation', 'V'),
      t('flange', 'Mounting flange', 'Bride de montage', {placeholder: 'ISO 9409-1-50-4-M6', max: 80}),
      communication, weight, dimensions, ip,
    ],
  },
  {
    id: 'pieces-mecaniques', en: 'Mechanical parts, structures & materials', fr: 'Pièces mécaniques, structures et matériaux adaptés', category: 'metal',
    kindCategory: {molded: 'plasturgie'},
    fields: [
      kind([
        {value: 'machined', en: 'Machined part', fr: 'Pièce usinée'},
        {value: 'structure', en: 'Structure / frame', fr: 'Structure / châssis'},
        {value: 'casting', en: 'Casting', fr: 'Pièce de fonderie'},
        {value: 'molded', en: 'Moulded plastic part', fr: 'Pièce plastique moulée'},
        {value: 'sheet_metal', en: 'Sheet metal part', fr: 'Pièce de tôlerie'},
        {value: 'additive', en: 'Additive manufacturing', fr: 'Fabrication additive'},
      ]),
      n('tolerance_mm', 'General tolerance', 'Tolérance générale', 'mm', {required: true, hintEn: 'Value of ± tolerance.', hintFr: 'Valeur de la tolérance ±.'}),
      n('surface_roughness_ra', 'Surface roughness (Ra)', 'Rugosité (Ra)', 'µm'),
      t('surface_treatment', 'Surface treatment', 'Traitement de surface', {placeholder: 'Anodising, nickel plating…', max: 120}),
      t('heat_treatment', 'Heat treatment', 'Traitement thermique', {max: 120}),
      t('max_dimensions_mm', 'Maximum part size', 'Dimensions maximales', {unit: 'mm', placeholder: '600 × 400 × 300', max: 60}),
      weight,
    ],
  },
  {
    id: 'autre', en: 'Other component', fr: 'Autre composant', category: 'other',
    fields: [],
  },
];

export function productFamily(id: string | undefined | null): ProductFamily | undefined {
  return productFamilies.find(f => f.id === id);
}

/** Fields of a family for the selected kind, followed by the shared compatibility field. */
export function specFields(familyId: string, kindValue = ''): SpecField[] {
  const family = productFamily(familyId);
  if (!family) return [];
  return [...family.fields.filter(f => !f.kinds || f.kinds.includes(kindValue)), compatibilityField];
}

function allFields(familyId: string): SpecField[] {
  const family = productFamily(familyId);
  if (!family) return [];
  const seen = new Set<string>();
  return [...family.fields, compatibilityField].filter(f => !seen.has(f.key) && seen.add(f.key));
}

export function isRequired(field: SpecField, kindValue: string) {
  return field.required === true || (Array.isArray(field.required) && field.required.includes(kindValue));
}

const cleanValue = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
/** Decimal written with a comma or spaces, as typed in French, becomes `1250.5`. */
export function normalizeNumber(value: string) {
  return value.replace(/[\s  ]/g, '').replace(',', '.');
}
function validNumber(value: string, signed = false) {
  return (signed ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/).test(value) && value.length <= 20;
}

/** Keeps only the fields relevant to the family and kind, normalised for storage. */
export function normalizeSpecs(familyId: string, specs: Record<string, string> | undefined): Record<string, string> {
  const source = specs || {};
  const fields = specFields(familyId, cleanValue(source[KIND_KEY]));
  const out: Record<string, string> = {};
  for (const field of fields) {
    let value = cleanValue(source[field.key]).slice(0, field.max || 120);
    if (field.type === 'number') value = normalizeNumber(value);
    if (value) out[field.key] = value;
  }
  return out;
}

export type SpecIssue = {key: string; code: 'REQUIRED' | 'NUMBER' | 'OPTION' | 'FAMILY'; en: string; fr: string};
/** Validation shared by the form and the publication route. */
export function specIssues(familyId: string, specs: Record<string, string> | undefined): SpecIssue[] {
  const family = productFamily(familyId);
  if (!family) return [{key: 'family', code: 'FAMILY', en: 'Choose the product type.', fr: 'Choisissez le type de produit.'}];
  const source = specs || {};
  const kindValue = cleanValue(source[KIND_KEY]);
  const out: SpecIssue[] = [];
  for (const field of specFields(familyId, kindValue)) {
    const raw = cleanValue(source[field.key]);
    const value = field.type === 'number' ? normalizeNumber(raw) : raw;
    if (!value) {
      if (isRequired(field, kindValue)) out.push({key: field.key, code: 'REQUIRED', en: field.en, fr: field.fr});
      continue;
    }
    if (field.type === 'number' && !validNumber(value, field.signed)) out.push({key: field.key, code: 'NUMBER', en: field.en, fr: field.fr});
    if (field.type === 'select' && !field.options?.some(o => o.value === value)) out.push({key: field.key, code: 'OPTION', en: field.en, fr: field.fr});
  }
  return out;
}

export function categoryForFamily(familyId: string, specs: Record<string, string> | undefined, legacyCategory = ''): string {
  const family = productFamily(familyId);
  if (!family) return legacyCategory;
  if (family.id === 'autre') return legacyCategories.some(c => c.value === legacyCategory) ? legacyCategory : 'other';
  return family.kindCategory?.[cleanValue(specs?.[KIND_KEY])] || family.category;
}

export type SpecRow = {key: string; en: string; fr: string; value: string; valueEn: string; valueFr: string; unit?: string; unitFr?: string};
/** Labelled rows, in schema order, for the fields that have a value. */
export function productSpecRows(familyId: string, specs: Record<string, string> | undefined): SpecRow[] {
  const kindValue = cleanValue(specs?.[KIND_KEY]);
  // Without a type (e.g. values reviewed by GSL only), every field of the family can be shown once.
  const fields = kindValue ? specFields(familyId, kindValue) : allFields(familyId);
  const source: Record<string, string> = kindValue ? normalizeSpecs(familyId, specs) : Object.fromEntries(fields.map(f => [f.key, f.type === 'number' ? normalizeNumber(cleanValue(specs?.[f.key])) : cleanValue(specs?.[f.key]).slice(0, f.max || 120)]));
  return fields.filter(f => source[f.key]).map(f => {
    const value = source[f.key];
    const option = f.options?.find(o => o.value === value);
    return {key: f.key, en: f.en, fr: f.fr, value, valueEn: option?.en || value, valueFr: option?.fr || value, unit: f.unit, unitFr: f.unitFr};
  });
}

/** `12 N·m`, `50:1`, `14S4P`. French decimals use a comma. */
export function formatSpecRow(row: SpecRow, language = 'en'): string {
  const french = language === 'fr';
  let value = french ? row.valueFr : row.valueEn;
  if (french && /^-?\d+(\.\d+)?$/.test(value)) value = value.replace('.', ',');
  const unit = (french && row.unitFr) || row.unit;
  if (!unit) return value;
  return unit.startsWith(':') ? value + unit : `${value} ${unit}`;
}

// Published block. The heading and line format are fixed: they are parsed back below.
export const SPEC_BLOCK_HEADING = 'Technical specifications (declared by the supplier)';
const FAMILY_LINE = 'Product family';

export function specificationBlock(familyId: string, specs: Record<string, string> | undefined): string {
  const family = productFamily(familyId);
  if (!family) return '';
  const rows = productSpecRows(familyId, specs);
  return [SPEC_BLOCK_HEADING, `- ${FAMILY_LINE}: ${family.en}`, ...rows.map(r => `- ${r.en}: ${formatSpecRow(r, 'en')}`)].join('\n');
}

/** Removes a previously published block, returning the supplier's own description. */
export function stripSpecificationBlock(description: string): string {
  const index = description.lastIndexOf(SPEC_BLOCK_HEADING);
  if (index < 0) return description;
  const before = description.slice(0, index);
  if (before.length && !/\n\n$/.test(before)) return description;
  return before.replace(/\s+$/, '');
}

/** Description sent to publish_supplier_products: own text + fixed specification block. */
export function composePublishedDescription(description: string, familyId: string, specs: Record<string, string> | undefined): string {
  const own = stripSpecificationBlock(description || '').trim();
  const block = specificationBlock(familyId, specs);
  return block ? `${own}\n\n${block}` : own;
}

/** Parses a published description into the supplier text, family and stored values. */
export function parsePublishedDescription(description: string): {description: string; familyId: string; specs: Record<string, string>} {
  const own = stripSpecificationBlock(description || '');
  if (own === description) return {description, familyId: '', specs: {}};
  const lines = description.slice(description.lastIndexOf(SPEC_BLOCK_HEADING) + SPEC_BLOCK_HEADING.length).split('\n').map(line => line.trim()).filter(line => line.startsWith('- '));
  const pairs = lines.map(line => {const i = line.indexOf(': '); return i < 0 ? null : [line.slice(2, i).trim(), line.slice(i + 2).trim()] as const;}).filter(Boolean) as (readonly [string, string])[];
  const familyName = pairs.find(([label]) => label === FAMILY_LINE)?.[1] || '';
  const family = productFamilies.find(f => f.en === familyName);
  if (!family) return {description: own, familyId: '', specs: {}};
  const all = [...family.fields, compatibilityField];
  const specs: Record<string, string> = {};
  // The kind is read first: field labels can repeat across kinds of the same family.
  const kindField = family.fields.find(f => f.key === KIND_KEY);
  const kindLabel = pairs.find(([label]) => label === kindField?.en)?.[1];
  const kindOption = kindField?.options?.find(o => o.en === kindLabel);
  if (kindOption) specs[KIND_KEY] = kindOption.value;
  const visible = specFields(family.id, specs[KIND_KEY] || '');
  for (const [label, text] of pairs) {
    const field = visible.find(f => f.en === label) || all.find(f => f.en === label);
    if (!field || field.key === KIND_KEY || specs[field.key]) continue;
    let value = text;
    if (field.unit) {
      if (field.unit.startsWith(':') && value.endsWith(field.unit)) value = value.slice(0, -field.unit.length);
      else if (value.endsWith(' ' + field.unit)) value = value.slice(0, -(field.unit.length + 1));
    }
    if (field.options) value = field.options.find(o => o.en === value)?.value || value;
    specs[field.key] = value.trim();
  }
  return {description: own, familyId: family.id, specs};
}

export type PublishedProductInput = {category?: string | null; description?: string | null; specifications?: Record<string, unknown> | null};
export type PublishedRows = {description: string; familyId: string; family?: ProductFamily; rows: SpecRow[]; commercial: SpecRow[]};

const commercialRow = (key: string, en: string, fr: string, value: string, valueFr = value, unit?: string): SpecRow => ({key, en, fr, value, valueEn: value, valueFr, unit});

/**
 * For public pages: description without the technical block, the product family and
 * labelled rows with units. Values reviewed by GSL in `specifications` (robotics
 * admission, e.g. torque_nm) take precedence over the supplier's declared value.
 * Render a row with `l(row.en,row.fr)` and `formatSpecRow(row, language)`.
 */
export function publishedSpecificationRows(product: PublishedProductInput): PublishedRows {
  const s: Record<string, string> = Object.fromEntries(Object.entries(product.specifications || {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  const parsed = parsePublishedDescription(product.description || '');
  const familyId = parsed.familyId || (productFamily(s.robotics_family) ? s.robotics_family : '') || (productFamily(product.category || '') ? product.category || '' : '');
  const merged: Record<string, string> = {...parsed.specs};
  for (const field of merged[KIND_KEY] ? specFields(familyId, merged[KIND_KEY]) : allFields(familyId)) if (s[field.key]) merged[field.key] = s[field.key];
  const rows = familyId ? productSpecRows(familyId, merged) : [];
  const commercial: SpecRow[] = [];
  if (s.reference) commercial.push(commercialRow('reference', 'Reference', 'Référence', s.reference));
  if (s.minimum_quantity) {
    const unit = quantityUnitLabels[s.unit || ''];
    commercial.push(commercialRow('minimum_quantity', 'Minimum order quantity', 'Quantité minimale de commande', s.minimum_quantity, s.minimum_quantity.replace('.', ','), unit ? undefined : s.unit || undefined));
    if (unit) {commercial[commercial.length - 1].valueEn += ' ' + unit.en; commercial[commercial.length - 1].valueFr += ' ' + unit.fr;}
  }
  if (s.lead_time) commercial.push(commercialRow('lead_time', 'Lead time', 'Délai', s.lead_time));
  if (s.materials) commercial.push(commercialRow('materials', 'Materials', 'Matières', s.materials));
  if (s.processes) commercial.push(commercialRow('processes', 'Processes', 'Procédés', s.processes));
  return {description: parsed.description, familyId, family: productFamily(familyId), rows, commercial};
}
