/** Public catalogue payloads never advertise an off-platform contact route.
 * Private applications and editorial records retain the original information.
 */
const contactKey=/^(?:website|web_?site|url|source_?url|email|e-?mail|phone|telephone|tel|fax|referenceContact|address|street|postal_?code|contact_?(?:email|phone|name|url))$/i;
export function publicContactText(value:string):string{
 return value
  .replace(/(?:https?:\/\/|www\.)[^\s<>"\]]+/gi,'')
  .replace(/(?:mailto:)?[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gi,'')
  .replace(/(?:tel:|\b(?:phone|telephone|téléphone|tél|fax)\s*:?\s*)\+?\d[\d ().-]{6,}\d/gi,'')
  .replace(/\+\d{1,3}[ .()-]+(?:\d[ .()-]*){7,14}\d/g,'')
  .replace(/\+\d{8,15}(?!\d)/g,'')
  .trim();
}
export function publicCatalogueValue<T>(value:T):T{
 if(typeof value==='string'){
  // Versioned research and source lists are stored as JSON strings in specifications.
  if(/^[\[{]/.test(value.trim())){try{return JSON.stringify(publicCatalogueValue(JSON.parse(value))) as T}catch{/* Plain technical text. */}}
  return publicContactText(value) as T;
 }
 if(Array.isArray(value))return value.map(item=>publicCatalogueValue(item)) as T;
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,contactKey.test(key)?'':publicCatalogueValue(item)])) as T;
 return value;
}
