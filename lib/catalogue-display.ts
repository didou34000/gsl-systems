import {researchCategories, type ProductCommercial} from './catalogue-research';

export const legacyCategoryIds = ['metal', 'electricite', 'emballage', 'textile', 'plasturgie', 'machines', 'construction', 'mobilier'] as const;
export const catalogueCategoryIds: readonly string[] = [...legacyCategoryIds, ...researchCategories.map(category => category.id)];

export function categoryGroup(category: string) {
  return researchCategories.find(item => item.id === category)?.group || category;
}

export function researchDate(value: string, locale = 'fr') {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(date);
}

/** Keep missing data distinct from zero, and make structured published details readable. */
export function researchValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return value ? 'Oui / Yes' : 'Non / No';
  if (Array.isArray(value)) return value.map(researchValue).filter(Boolean).join(' · ') || null;
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => {
    const text = researchValue(item);
    return text === null ? null : `${key.replace(/_/g, ' ')} : ${text}`;
  }).filter(Boolean).join('\n') || null;
  return null;
}

export function publishedPrice(commercial: ProductCommercial, locale = 'fr'): string | null {
  const amounts = [commercial.price_min, commercial.price_max].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!amounts.length) return null;
  const format = (value: number) => new Intl.NumberFormat(locale, {minimumFractionDigits: commercial.currency ? 2 : 0, maximumFractionDigits: 8}).format(value);
  const amount = amounts.length === 2 && amounts[0] !== amounts[1] ? `${format(amounts[0])} – ${format(amounts[1])}` : format(amounts[0]);
  return [amount, commercial.currency || ''].filter(Boolean).join(' ') + (commercial.unit ? ` / ${commercial.unit}` : '');
}

export function gslContactHref(supplier: string, product?: string) {
  return product ? '/messagerie?product=' + encodeURIComponent(product) : '/messagerie?supplier=' + encodeURIComponent(supplier);
}
