import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transpileModule, ModuleKind, ScriptTarget} from 'typescript';

async function loadModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const code = transpileModule(source, {compilerOptions: {module: ModuleKind.ESNext, target: ScriptTarget.ES2022}}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

const [{securityEnglish, securityTranslations, securityTranslate}, {languageOptions, localizedHref}, {safeNext}] = await Promise.all([
  loadModule('../lib/security/translations.ts'),
  loadModule('../lib/i18n/languages.ts'),
  loadModule('../lib/auth-policy.ts'),
]);
const keys = Object.keys(securityEnglish).sort();
const locales = languageOptions.map(({code}) => code);
assert.equal(locales.length, 10);
assert.equal(new Set(locales).size, 10);
assert.ok(keys.length >= 86, 'The security journey must retain its full translation contract');
assert.deepEqual(Object.keys(securityTranslations).sort(), [...locales].sort(), 'Every supported language needs a security dictionary');
for (const locale of locales) {
  const labels = securityTranslations[locale];
  assert.deepEqual(Object.keys(labels).sort(), keys, locale + ': missing or extraneous security labels');
  for (const key of keys) {
    assert.equal(typeof labels[key], 'string', `${locale}.${key}: non-text label`);
    assert.ok(labels[key].trim(), `${locale}.${key}: empty label`);
    assert.equal(securityTranslate(locale, key), labels[key], `${locale}.${key}: translation lookup mismatch`);
    assert.ok(!labels[key].includes('\ufffd'), `${locale}.${key}: broken character encoding`);
  }
  if (locale !== 'en') assert.ok(keys.some(key => labels[key] !== securityEnglish[key]), locale + ': untranslated dictionary');
}
assert.equal(securityTranslate('fr', 'title'), 'Sécurité du compte');
assert.equal(securityTranslate('fr', 'verify'), 'Confirmer mon code');
assert.equal(securityTranslate('zh', 'title'), '账户安全');

// Exercise the real authentication redirect policy across the nested URL used by
// the security center: sign in -> security page -> original permitted workspace.
const destinations = ['/compte', '/administration', '/administration/revue'];
let returnChecks = 0;
for (const locale of locales) {
  for (const destination of destinations) {
    const securityPath = '/compte/securite?next=' + encodeURIComponent(destination);
    const loginHref = localizedHref('/connexion?next=' + encodeURIComponent(securityPath), locale);
    const loginUrl = new URL(loginHref, 'https://www.gsl-systems.com');
    assert.equal(loginUrl.searchParams.get('lang'), locale === 'en' ? null : locale);
    const authenticatedReturn = safeNext(loginUrl.searchParams.get('next'));
    const securityUrl = new URL(localizedHref(authenticatedReturn, locale), loginUrl.origin);
    assert.equal(securityUrl.origin, loginUrl.origin, 'Authentication must keep the return on the site');
    assert.equal(securityUrl.pathname, '/compte/securite', 'Authentication must return to the dedicated security page');
    assert.equal(securityUrl.searchParams.get('next'), destination, 'The intended workspace must survive nested encoding');
    assert.equal(securityUrl.searchParams.get('lang'), locale === 'en' ? null : locale);
    assert.equal(safeNext(securityUrl.searchParams.get('next')), destination);
    returnChecks++;
  }
}

const hostileReturns = [
  undefined, null, {}, [], 42, '', 'administration',
  'https://attacker.invalid', 'http://attacker.invalid', 'javascript:alert(1)',
  '//attacker.invalid', '/\\attacker.invalid', '/%2f%2fattacker.invalid',
  '/%252f%252fattacker.invalid', '/%25252f%25252fattacker.invalid',
  '/%2525252f%2525252fattacker.invalid', '/%5cattacker.invalid', '/%255cattacker.invalid',
  '/\n/attacker.invalid', '/%0d%0aLocation:https://attacker.invalid', '/%00anything',
  '/%09/attacker.invalid', '/%20/attacker.invalid', '/%zz', '/%E0%A4%A',
  '/api/account/mfa', '/api%2fauth', '/auth/callback?code=anything',
  '/compte/../api/auth', '/compte/../auth/callback', '/connexion?next=%2Fadministration',
  '/confirmer-email', '/inscription', '/mot-de-passe-oublie', '/nouveau-mot-de-passe', '/signin', '/signout',
];
for (const candidate of hostileReturns) assert.equal(safeNext(candidate), '/compte', 'Unsafe authentication return: ' + JSON.stringify(candidate));
assert.equal(safeNext('/administration#settings'), '/administration', 'Fragments must not alter the server return target');
assert.equal(safeNext('/compte/securite'), '/compte/securite');
const {normalizeAuthenticatorCode} = await loadModule('../lib/security/code.ts');
for (const code of ['123456', '123 456', '١٢٣٤٥٦', '۱۲۳۴۵۶', '१२३४५६', '１２３４５６', '\u200e123 456\u200f']) {
  assert.equal(normalizeAuthenticatorCode(code), '123456', 'Local or pasted code: ' + code);
}
assert.equal(normalizeAuthenticatorCode('01234567'), '012345');
assert.equal(normalizeAuthenticatorCode('not a code'), '');
assert.equal(normalizeAuthenticatorCode('000001'), '000001');
console.log(`Security UI contract passed: ${keys.length} complete labels × ${locales.length} languages, ${returnChecks} nested authentication return paths, ${hostileReturns.length} hostile redirects rejected.`);
