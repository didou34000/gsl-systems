import {countryCodes} from './iso-countries';
/** Initial commercial coverage. Kept separate from ISO validation to preserve existing drafts. */
const priorityGroups=[
 {en:'Europe',fr:'Europe',codes:['FR','DE','IT','ES','PL','RO','GB']},
 {en:'International',fr:'International',codes:['TR','GE','MA','TN','US','CN']},
] as const;
const priority=priorityGroups.flatMap(g=>[...g.codes]) as string[];
export const countryGroups=[...priorityGroups,{en:'Other countries · manual review',fr:'Autres pays · revue manuelle',codes:countryCodes.filter(c=>!priority.includes(c))}];
export const availableCountries:readonly string[]=countryCodes;
