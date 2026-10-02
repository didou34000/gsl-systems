import labels from './maps/country-labels.json';
// Fixed labels and ordering keep server/browser ICU versions from disagreeing at hydration.
export function countryOptions(language:'fr'|'en'){return labels[language];}
export function countryName(code:string,language:'fr'|'en'){return labels[language].find(c=>c.code===code)?.name||code;}
