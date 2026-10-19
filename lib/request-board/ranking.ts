/**
 * Request board ranking: pure, deterministic, no imports (compiled alone by scripts/test-request-board.mjs).
 *
 * For a signed-in manufacturer, each request gets a score from 0 to 100:
 *   family     35  request family matches a family of the maker's published products (25 if only via declared processes/materials keywords)
 *   capability 15  request text mentions one of the maker's declared processes or materials
 *   country    10  no buyer constraint on origin, or the maker's country satisfies it (0 when it does not)
 *   quantity   10  request quantity ≥ maker MOQ in the same unit (5 when unknown, 0 when below)
 *   deadline   10  days left ≥ maker lead time (5 when either is unknown, 0 when too short; past deadline = 0)
 *   freshness  10  linear decay over 60 days since publication
 *   complete   10  2 per present element: deadline, quantities, specs, family, ≥2 chars title
 * Ties: higher score, then nearer deadline, then newer, then reference.
 * Visitors and buyers: sorted by freshness (published in the last 14 days first), then nearest deadline, then newer.
 */

export const boardFamilies = ['actionnement-transmission','transmissions-guidages','capteurs-vision','commande-electronique','cables-connecteurs','energie-batteries','prehension','pieces-mecaniques'] as const;
export const OTHER_FAMILY = 'autre';
export const weights = {family:35,capability:15,country:10,quantity:10,deadline:10,freshness:10,completeness:10} as const;

export type BoardItem = {description: string; quantity: number; unit: string; specs?: string};
export type BoardRequest = {
  reference: string; shared_at: string; destination: string; deadline: string | null; lines: number;
  families: string[]; total_quantity?: number | null; origin?: string[] | null;
  title?: string; items?: BoardItem[]; specs?: string; responded_at?: string | null;
};
export type MakerProfile = {
  country: string; families: string[]; processes: string[]; materials: string[];
  moq: {quantity: number; unit: string}[]; leadTimeDays: number | null;
};
export type Reason = {key: string; en: string; fr: string; n?: number; family?: string};
export type Ranked<T extends BoardRequest = BoardRequest> = T & {score: number | null; reasons: Reason[]};

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Keyword rules used to place a request without a declared family. Order does not matter; all matches apply. */
const keywords: Record<string, RegExp> = {
  'actionnement-transmission': /\b(moteurs?|motors?|servo\w*|actionneurs?|actuators?|verins?|brushless|bldc|pas a pas|stepper)\b/,
  'transmissions-guidages': /\b(reducteurs?|reducers?|gearbox\w*|harmonic|cycloid\w*|engrenages?|gears?|roulements?|bearings?|vis a billes|ball ?screws?|guidages?|rails? lineaires?|linear guides?|courroies?|belts?)\b/,
  'capteurs-vision': /\b(capteurs?|sensors?|codeurs?|encodeurs?|encoders?|cameras?|vision|lidar|imu|centrales? inertielles?|force|couple-?metres?|torque sensors?)\b/,
  'commande-electronique': /\b(cartes?|pcb\w*|controleurs?|controllers?|drivers?|variateurs?|electronique|electronics?|calculateurs?|embedded|embarque\w*|microcontroleurs?|fpga)\b/,
  'cables-connecteurs': /\b(cables?|connecteurs?|connectors?|faisceaux|harness\w*|fils?|wires?)\b/,
  'energie-batteries': /\b(batteries?|accus?|bms|chargeurs?|chargers?|alimentations?|power supplies|power supply|cellules?|cells?|li-?ion)\b/,
  'prehension': /\b(prehenseurs?|pinces?|grippers?|effecteurs?|end effectors?|ventouses?|suction cups?|mains? robotiques?|robot hands?)\b/,
  'pieces-mecaniques': /\b(usinage|usine\w*|machin\w*|carters?|chassis|structures?|boitiers?|housings?|brackets?|supports?|toles?|sheet metal|fonderie|casting|injection|moul\w*|impression 3d|3d print\w*|aluminium|acier|steel|titane|titanium)\b/,
};

/** Families from text, for requests saved without a declared family. */
export function inferFamilies(text: string): string[] {
  const t = norm(text);
  return boardFamilies.filter(f => keywords[f].test(t));
}

/** Declared family first, then families inferred from the title and lines. Never empty: falls back to "autre". */
export function requestFamilies(declared: string[], text: string): string[] {
  const known = declared.filter(f => (boardFamilies as readonly string[]).includes(f));
  const out = known.length ? known : inferFamilies(text);
  return out.length ? [...new Set(out)] : [OTHER_FAMILY];
}

export function daysBetween(from: Date, to: string): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const [y, m, d] = to.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86400000);
}

/** "4 semaines", "6-8 weeks", "30 jours", "2 mois", "45 days" → days (upper bound of a range). */
export function parseLeadTimeDays(text: string): number | null {
  const t = norm(text);
  const m = t.match(/(\d+(?:[.,]\d+)?)(?:\s*(?:-|a|to|–)\s*(\d+(?:[.,]\d+)?))?\s*(jours?|j\b|days?|d\b|semaines?|sem\b|weeks?|wk|mois|months?)/);
  if (!m) return null;
  const n = Number((m[2] || m[1]).replace(',', '.'));
  const unit = m[3];
  const factor = /^(semaine|sem|week|wk)/.test(unit) ? 7 : /^(mois|month)/.test(unit) ? 30 : 1;
  return Number.isFinite(n) && n > 0 ? Math.round(n * factor) : null;
}

const requestText = (r: BoardRequest) => norm([r.title || '', r.specs || '', ...(r.items || []).map(i => i.description + ' ' + (i.specs || ''))].join(' '));

function completeness(r: BoardRequest): number {
  let n = 0;
  if (r.deadline) n++;
  if ((r.items?.length ? r.items.every(i => i.quantity > 0) : (r.total_quantity || 0) > 0)) n++;
  if ((r.specs || '').trim() || r.items?.some(i => (i.specs || '').trim())) n++;
  if (r.families.some(f => f !== OTHER_FAMILY)) n++;
  if ((r.title || '').trim().length >= 2 || r.lines > 0) n++;
  return n * 2;
}

function freshness(r: BoardRequest, now: Date): number {
  const age = Math.max(0, -daysBetween(now, r.shared_at));
  return Math.max(0, Math.round(10 * (1 - age / 60)));
}

export function familyLabelReason(family: string): Reason {
  return {key: 'family', en: 'Matches your products', fr: 'Correspond à vos produits', family};
}

/** Score one request for one manufacturer. Returns 0–100 and reasons in plain words (most important first). */
export function scoreRequest(r: BoardRequest, maker: MakerProfile, now: Date): {score: number; reasons: Reason[]} {
  const reasons: Reason[] = [];
  let score = 0;
  const text = requestText(r);
  const fam = r.families.find(f => maker.families.includes(f));
  const capWords = [...maker.processes, ...maker.materials].map(norm).map(s => s.trim()).filter(s => s.length >= 3);
  const capHit = capWords.find(w => text.includes(w));
  if (fam) { score += weights.family; reasons.push(familyLabelReason(fam)); }
  else if (capHit && r.families.includes(OTHER_FAMILY)) { score += 25; }
  if (capHit) { score += weights.capability; reasons.push({key: 'capability', en: 'Mentions a process or material you declared', fr: 'Mentionne un procédé ou une matière que vous déclarez'}); }

  const origin = (r.origin || []).filter(Boolean);
  if (!origin.length || origin.includes(maker.country)) score += weights.country;
  else reasons.push({key: 'origin', en: 'The buyer prefers another production country', fr: 'L’acheteur préfère un autre pays de production'});

  const qty = r.items?.length ? r.items : null;
  const moqs = maker.moq.filter(m => m.quantity > 0);
  let qScore = 5;
  if (qty && moqs.length) {
    const comparable = qty.flatMap(i => moqs.filter(m => m.unit === i.unit).map(m => i.quantity >= m.quantity));
    if (comparable.length) {
      qScore = comparable.some(Boolean) ? weights.quantity : 0;
      reasons.push(qScore ? {key: 'moq', en: 'Quantity meets your minimum order', fr: 'Quantité compatible avec votre minimum de commande'} : {key: 'moq-low', en: 'Quantity below your minimum order', fr: 'Quantité inférieure à votre minimum de commande'});
    }
  }
  score += qScore;

  if (r.deadline) {
    const days = daysBetween(now, r.deadline);
    if (days < 0) reasons.push({key: 'past', en: 'Deadline passed', fr: 'Échéance dépassée'});
    else {
      const lead = maker.leadTimeDays;
      score += lead == null ? 5 : days >= lead ? weights.deadline : 0;
      reasons.push(lead != null && days < lead
        ? {key: 'tight', en: 'Deadline in {n} days, shorter than your lead time', fr: 'Échéance dans {n} jours, plus courte que votre délai', n: days}
        : {key: 'deadline', en: 'Deadline in {n} days', fr: 'Échéance dans {n} jours', n: days});
    }
  } else score += 5;

  const f = freshness(r, now);
  score += f;
  if (f >= 8) reasons.push({key: 'new', en: 'Published recently', fr: 'Publiée récemment'});
  score += completeness(r);
  return {score: Math.min(100, score), reasons: reasons.slice(0, 3)};
}

const deadlineKey = (r: BoardRequest) => r.deadline || '9999-12-31';
const byFallback = (a: BoardRequest, b: BoardRequest) => deadlineKey(a).localeCompare(deadlineKey(b)) || b.shared_at.localeCompare(a.shared_at) || a.reference.localeCompare(b.reference);

/** Sorts requests. With a maker profile, by relevance score; otherwise by freshness then deadline. */
export function rankRequests<T extends BoardRequest>(requests: T[], maker: MakerProfile | null, now: Date): Ranked<T>[] {
  if (maker) {
    return requests.map(r => ({...r, ...scoreRequest(r, maker, now)}))
      .sort((a, b) => b.score - a.score || byFallback(a, b));
  }
  return requests.map(r => {
    const reasons: Reason[] = [];
    if (r.deadline) { const n = daysBetween(now, r.deadline); if (n >= 0) reasons.push({key: 'deadline', en: 'Deadline in {n} days', fr: 'Échéance dans {n} jours', n}); }
    return {...r, score: null, reasons};
  }).sort((a, b) => {
    const fa = -daysBetween(now, a.shared_at) <= 14 ? 0 : 1, fb = -daysBetween(now, b.shared_at) <= 14 ? 0 : 1;
    return fa - fb || byFallback(a, b);
  });
}

export type BoardFilters = {family?: string; destination?: string; deadlineWithin?: number | null; minQuantity?: number | null; maxQuantity?: number | null; q?: string};

export function requestQuantity(r: BoardRequest): number | null {
  if (r.items?.length) return r.items.reduce((s, i) => s + i.quantity, 0);
  return r.total_quantity ?? null;
}

export function filterRequests<T extends BoardRequest>(requests: T[], f: BoardFilters, now: Date): T[] {
  const q = norm(f.q || '').trim();
  return requests.filter(r => {
    if (f.family && !r.families.includes(f.family)) return false;
    if (f.destination && r.destination !== f.destination) return false;
    if (f.deadlineWithin != null) { if (!r.deadline) return false; const d = daysBetween(now, r.deadline); if (d < 0 || d > f.deadlineWithin) return false; }
    const qty = requestQuantity(r);
    if (f.minQuantity != null && (qty == null || qty < f.minQuantity)) return false;
    if (f.maxQuantity != null && (qty == null || qty > f.maxQuantity)) return false;
    if (q && !norm([r.reference, r.title || '', ...(r.items || []).map(i => i.description)].join(' ')).includes(q)) return false;
    return true;
  });
}

/** Counts per family (a request with several families counts in each). */
export function familyCounts(requests: BoardRequest[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of requests) for (const f of new Set(r.families.length ? r.families : [OTHER_FAMILY])) out[f] = (out[f] || 0) + 1;
  return out;
}
