/** Initial commercial coverage. Kept separate from ISO validation to preserve existing drafts. */
export const countryGroups=[
 {en:'Europe',fr:'Europe',codes:['FR','DE','IT','ES','PL','RO','GB']},
 {en:'International',fr:'International',codes:['TR','GE','MA','TN','US','CN']},
] as const;
export const availableCountries:readonly string[]=countryGroups.flatMap(g=>[...g.codes]);
