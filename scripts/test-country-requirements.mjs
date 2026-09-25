import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(fs.readFileSync('lib/onboarding/country-requirements.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { countryRequirements, getCountryRequirements, assessCountryDetails } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const tr = { mersis: 'example', trade_registry_number: 'example', trade_registry_office: 'example' };
assert.equal(assessCountryDetails('TR', 'company', tr).complete, true);
assert.equal(assessCountryDetails('TR', 'company', tr).verificationStatus, 'unverified');
assert.deepEqual(assessCountryDetails('GE', 'company', tr).missing, ['identification_code']);
assert.equal(assessCountryDetails('GE', 'company', tr).complete, false);
assert.equal(assessCountryDetails('GE', 'company', { identification_code: 'example' }).complete, true);
assert.equal(assessCountryDetails('GE', 'sole_trader', {}).manualReviewRequired, true);
assert.equal(assessCountryDetails('TR', 'sole_trader', { tax_number: 'personal-id' }).complete, false);
assert.equal(assessCountryDetails('FR', 'company', { siren: 'example', approved: 'true' }).complete, false);
assert.equal(getCountryRequirements(' de ').reviewMode, 'manual_country_review');
assert.equal(getCountryRequirements('DE').researchedAt, '');
assert.throws(() => getCountryRequirements('Turkey'));
for (const pack of Object.values(countryRequirements)) {
  assert.ok(pack.sources.length > 0);
  assert.ok(pack.fields.every(f => f.visibility === 'private'));
  assert.equal(new Set(pack.fields.map(f => f.key)).size, pack.fields.length);
}
console.log('Country onboarding checks passed: country isolation, individual privacy, fallback, no self-verification.');
