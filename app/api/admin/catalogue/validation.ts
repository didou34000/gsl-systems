import {z} from 'zod';
import type {CatalogueMutation, CatalogueSnapshot} from '@/lib/admin/catalogue-types';

export const MAX_CATALOGUE_BODY_BYTES = 200_000;

// Context and digit counts avoid treating ordinary ISO/EN references as phone numbers.
const internationalPhone = /(?:\+\d[\d ().-]{8,}\d|\b00[1-9](?:[ ().-]*\d){7,14}\b)/;
const labelledPhone = /\b(?:téléphone|telephone|phone|tél|tel|contact|standard|fax)\b[^\d\n]{0,60}\d(?:[ ().-]*\d){9,14}\b/i;
const publicText = (max: number) => z.string().max(max).refine(
  value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    && !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)
    && !internationalPhone.test(value) && !labelledPhone.test(value),
  'Public text must not contain supplier contact details or control characters.',
);
const requiredText = (max: number) => publicText(max).refine(value => value.trim().length > 0, 'Required');
const sourceUrl = z.string().max(2048).refine(value => {
  try {
    if (!/^https?:\/\/[A-Za-z0-9]/.test(value) || /[\s<>"@]/.test(value)) return false;
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch {return false;}
}, 'A public HTTP(S) URL is required.');
const source = z.object({url: sourceUrl, title: requiredText(500), supports: publicText(4000).optional()}).strict();
const sources = z.array(source).min(1).max(60);
const date = z.string().max(10).refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value.slice(0, 10);
}, 'An ISO date is required.');
const list = z.array(requiredText(500)).max(80);
const revision = z.number().int().min(1).max(999_999_999);
const identity = {id: z.string().uuid(), revision};
const recordKey = z.string().min(1).max(200).refine(value =>
  value === value.trim() && !['__proto__', 'constructor', 'prototype', 'research_data'].includes(value)
  && !/(?:^|[_\s-])(email|e-mail|phone|telephone|téléphone|fax|contact)(?:$|[_\s-])/i.test(value),
  'Reserved or private field name.',
);
const technicalSpecifications = z.record(recordKey, publicText(6000)).refine(value => Object.keys(value).length <= 100, 'Too many specifications.');
const agreement = z.object({
  code: publicText(80), agreement: publicText(2000), date: publicText(500),
  benefit: publicText(8000), proof: publicText(8000), limits: publicText(8000),
  sources: z.array(source).max(30),
}).strict();
const rule = z.object({
  id: requiredText(120), type: publicText(200), title: requiredText(1500),
  scope: publicText(8000), requirements: publicText(12000), limits: publicText(8000),
  sources: z.array(source).max(30),
}).strict();

export const companyResearchSchema = z.object({
  kind: z.literal('gsl_research'), schemaVersion: z.literal(1), sourceId: requiredText(120), checkedAt: date,
  sector: requiredText(3000), family: publicText(2000), categories: z.array(requiredText(120)).max(30),
  productFamilies: publicText(8000), processes: publicText(8000), certifications: publicText(8000),
  certificationStatus: publicText(3000), certificationDates: publicText(3000),
  evidenceLevel: z.enum(['D', 'R', 'F', 'H', 'N']), europeanMarket: publicText(8000),
  agreement, regulations: z.array(rule).max(40), sources,
}).strict();

const positive = z.number().finite().positive().max(1_000_000_000_000);
const nullableText = (max: number) => requiredText(max).nullable();
export const productResearchSchema = z.object({
  kind: z.literal('gsl_research'), schemaVersion: z.literal(1), sourceId: requiredText(180), checkedAt: date,
  specifications: technicalSpecifications, applications: list, materials: list,
  customization: nullableText(4000), companySourceId: requiredText(120), scopeNote: publicText(6000).optional(),
  commercial: z.object({
    price_min: positive.nullable(), price_max: positive.nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(), unit: nullableText(200),
    moq: positive.nullable(),
    lead_time: nullableText(2000), terms: nullableText(8000), status: requiredText(1000),
    availability: nullableText(2000).optional(),
    price_tiers: z.array(z.object({quantity: positive, price: positive}).strict()).max(50).optional(),
    minimum_price_quantity: positive.nullable().optional(),
  }).strict(),
  sources,
}).strict().superRefine((value, context) => {
  const {price_min: min, price_max: max, currency, unit} = value.commercial;
  if (min !== null && max !== null && max < min) {
    context.addIssue({code: z.ZodIssueCode.custom, path: ['commercial', 'price_max'], message: 'Maximum price must be at least the minimum price.'});
  }
  if (min !== null || max !== null) {
    if (!currency) context.addIssue({code: z.ZodIssueCode.custom, path: ['commercial', 'currency'], message: 'Currency is required for a published price.'});
    if (!unit) context.addIssue({code: z.ZodIssueCode.custom, path: ['commercial', 'unit'], message: 'Unit is required for a published price.'});
  }
  const tiers = value.commercial.price_tiers;
  if (tiers?.length) {
    if (new Set(tiers.map(tier => tier.quantity)).size !== tiers.length) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ['commercial', 'price_tiers'], message: 'Quantity breaks must be unique.'});
    }
    if (tiers.some((tier, index) => index > 0 && tier.quantity <= tiers[index - 1].quantity)) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ['commercial', 'price_tiers'], message: 'Quantity breaks must be in increasing order.'});
    }
    if (min === null || max === null || !currency || !unit) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ['commercial', 'price_tiers'], message: 'Quantity prices require an explicit price range, currency and unit.'});
    }
    const minimum = Math.min(...tiers.map(tier => tier.price));
    if (min !== minimum || max !== Math.max(...tiers.map(tier => tier.price))) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ['commercial', 'price_tiers'], message: 'The price range must match the quantity prices.'});
    }
    if (!tiers.some(tier => tier.price === minimum && tier.quantity === value.commercial.minimum_price_quantity)) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ['commercial', 'minimum_price_quantity'], message: 'Identify the published quantity at which the minimum price applies.'});
    }
  }
});

const productSpecifications = z.record(z.string(), z.string()).superRefine((value, context) => {
  const {research_data, ...technical} = value;
  const specs = technicalSpecifications.safeParse(technical);
  if (!specs.success) {
    for (const issue of specs.error.issues) context.addIssue({...issue, path: issue.path});
  }
  if (typeof research_data !== 'string' || research_data.length > 160_000) {
    context.addIssue({code: z.ZodIssueCode.custom, path: ['research_data'], message: 'A sourced research document is required.'});
    return;
  }
  let research: unknown;
  try {research = JSON.parse(research_data);} catch {
    context.addIssue({code: z.ZodIssueCode.custom, path: ['research_data'], message: 'Invalid research JSON.'});
    return;
  }
  const parsed = productResearchSchema.safeParse(research);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) context.addIssue({...issue, path: ['research_data', ...issue.path]});
  }
});

export const catalogueMutationSchema: z.ZodType<CatalogueMutation> = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save_company'), ...identity, name: publicText(250).refine(value => value.trim().length >= 2, 'At least two characters are required.'),
    country: z.enum(['TR', 'MA', 'TN', 'RS', 'MK', 'BA', 'MD', 'GE', 'AL', 'EG']), city: publicText(250), description: requiredText(12000),
    processes: list, materials: list, website: sourceUrl.nullable(), research: companyResearchSchema,
  }).strict(),
  z.object({
    action: z.literal('save_product'), ...identity, name: publicText(250).refine(value => value.trim().length >= 2, 'At least two characters are required.'), reference: requiredText(250),
    category: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/), description: requiredText(12000), specifications: productSpecifications,
  }).strict(),
  z.object({action: z.literal('set_company_visibility'), ...identity, published: z.boolean()}).strict(),
  z.object({action: z.literal('set_product_visibility'), ...identity, published: z.boolean()}).strict(),
]);

export const catalogueSnapshotSchema: z.ZodType<CatalogueSnapshot> = z.object({
  companies: z.array(z.object({
    id: z.string().uuid(), name: z.string(), country: z.string(), city: z.string(), description: z.string(),
    processes: z.array(z.string()), materials: z.array(z.string()), website: z.string().nullable(),
    details: z.record(z.unknown()), revision, published: z.boolean(),
  }).strict()),
  products: z.array(z.object({
    id: z.string().uuid(), companyId: z.string().uuid(), name: z.string(), reference: z.string(),
    category: z.string(), description: z.string(), specifications: z.record(z.string()),
    revision, published: z.boolean(),
  }).strict()),
  recipients: z.array(z.object({userId: z.string().uuid(), name: z.string(), email: z.string().email()}).strict()),
  notificationStatus: z.object({pending: z.number().int().nonnegative(), failed: z.number().int().nonnegative()}).strict(),
  canManage: z.literal(true), emailConfigured: z.boolean(),
}).strict();

/** Bound the actual UTF-8 body, including chunked requests, before JSON parsing. */
export async function readCatalogueJson(request: Request): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_CATALOGUE_BODY_BYTES)) throw Error('INVALID');
  const reader = request.body?.getReader();
  if (!reader) throw Error('INVALID');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CATALOGUE_BODY_BYTES) {
        await reader.cancel();
        throw Error('INVALID');
      }
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  try {return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));}
  catch {throw Error('INVALID');}
}
