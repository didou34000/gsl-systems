import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:5191';
const countries=['tr','ma','tn','rs','mk','ba','md','ge','al','eg'];
const languages=['en','fr','es','pt','de','it','tr','ar','hi','zh'];
for(const country of countries){
 for(const language of languages){
  const response=await fetch(`${base}/pays/${country}?lang=${language}`);assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/country-guide-hero/);assert.match(html,/application\/ld\+json/);
  assert.ok(html.toLowerCase().includes(`hreflang="${language}"`));assert.ok(html.includes(`lang=${language}`));
  assert.match(html,/<link rel="canonical"[^>]+\/pays\//);
  assert.ok(html.includes('https://trade.ec.europa.eu/access-to-markets/en/home'));
  assert.ok(html.includes('id="documents"'));assert.ok(html.includes('id="conditions"'));
  assert.ok(!html.includes('This page is currently available in French'));
 }
}
const invalid=await fetch(base+'/pays/fr?lang=fr',{redirect:'manual'});assert.equal(invalid.status,308,'out-of-scope country redirects to the supported directory');assert.ok(invalid.headers.get('location').endsWith('/pays?lang=fr'));
const staleFilter=await fetch(base+'/fabricants?country=FR&lang=fr',{redirect:'manual'});assert.equal(staleFilter.status,307);assert.ok(!new URL(staleFilter.headers.get('location'),base).searchParams.has('country'));
console.log('100 country/locale pages render server-side with canonical, hreflang, structured data, documentary sections and official sources; out-of-scope country redirects to the supported directory.');
