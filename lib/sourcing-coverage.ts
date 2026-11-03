/** Countries with a researched EU trade-agreement guide (/pays/<code>). Buyer/delivery ISO countries remain independent. */
export const sourcingCountries=['TR','MA','TN','RS','MK','BA','MD','GE','AL','EG'] as const;
export type SourcingCountry=typeof sourcingCountries[number];
export const isSourcingCountry=(code:string):code is SourcingCountry=>sourcingCountries.some(c=>c===code);

/**
 * Countries where a manufacturer may register and publish: the guide countries above plus Europe
 * (EU, EEA, Switzerland, United Kingdom, Ukraine, Montenegro, Kosovo and the microstates).
 * Belarus and Russia stay out (EU restrictive measures). Must match public.gsl_sourcing_country.
 */
export const supplierCountries=[...sourcingCountries,
 'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
 'NO','IS','LI','CH','GB','UA','ME','XK','AD','SM','MC'] as const;
export type SupplierCountry=typeof supplierCountries[number];
export const isSupplierCountry=(code:string):code is SupplierCountry=>supplierCountries.some(c=>c===code);
