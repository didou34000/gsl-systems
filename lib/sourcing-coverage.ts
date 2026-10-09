/** Single commercial scope for supplier registration and manufacturing. Buyer/delivery ISO countries remain independent. */
export const sourcingCountries=['TR','MA','TN','RS','MK','BA','MD','GE','AL','EG'] as const;
export type SourcingCountry=typeof sourcingCountries[number];
export const isSourcingCountry=(code:string):code is SourcingCountry=>sourcingCountries.some(c=>c===code);
