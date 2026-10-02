/** Commercial sourcing scope from the original GSL country directory. Not an ISO validation list. */
export const sourcingCountries=['TR','MA','TN','GE'] as const;
export const isSourcingCountry=(code:string)=>sourcingCountries.some(c=>c===code);
