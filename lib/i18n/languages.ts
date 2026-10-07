export const languageOptions = [
  {code:'en',name:'English'}, {code:'fr',name:'Français'},
  {code:'es',name:'Español'}, {code:'pt',name:'Português'},
  {code:'de',name:'Deutsch'}, {code:'it',name:'Italiano'},
  {code:'tr',name:'Türkçe'}, {code:'ar',name:'العربية'},
  {code:'hi',name:'हिन्दी'}, {code:'zh',name:'中文'},
] as const;
export type Language = typeof languageOptions[number]['code'];
export function isLanguage(value:unknown):value is Language {
  return typeof value === 'string' && languageOptions.some(option=>option.code===value);
}
export function resolveLanguage(value:unknown):Language { return isLanguage(value)?value:'en'; }
export function languageDirection(language:Language) { return language==='ar'?'rtl':'ltr'; }
/** Preserve search parameters and fragments, and never rewrite external or API URLs. */
export function localizedHref(href:string, language:Language) {
  if(!href.startsWith('/')||href.startsWith('//')||/^\/api(?:\/|\?|$)/.test(href))return href;
  const url=new URL(href,'https://gsl.invalid');
  if(language==='en')url.searchParams.delete('lang');else url.searchParams.set('lang',language);
  return url.pathname+url.search+url.hash;
}
