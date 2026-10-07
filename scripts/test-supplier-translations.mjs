import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import ts from 'typescript';

const dictionaries = {};
for (const name of (await readdir('lib/i18n')).filter(name => name.endsWith('.json'))) {
  Object.assign(dictionaries, JSON.parse(await readFile(`lib/i18n/${name}`, 'utf8')));
}
const supplier = JSON.parse(await readFile('lib/i18n/supplier.json', 'utf8'));
for (const [key, row] of Object.entries(supplier)) {
  assert.equal(row.length, 8, `${key}: exactly eight translations required`);
  for (const value of row) {
    assert.equal(typeof value, 'string');
    assert.ok(value.trim().length, `${key}: empty translation`);
    const placeholders = text => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
    assert.deepEqual(placeholders(value), placeholders(key), `${key}: placeholders preserved`);
    if (key.endsWith(' ')) assert.ok(value.endsWith(' '), `${key}: concatenation space preserved`);
  }
}
const staticKeys = new Set();
for (const filename of ['app/supplier-workspace.tsx', 'app/company-branding.tsx', 'app/review-tools.tsx', 'app/request-files.tsx']) {
  const source = ts.createSourceFile(filename, await readFile(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'l') {
      const first = node.arguments[0];
      if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) staticKeys.add(first.text);
      if (first && ts.isElementAccessExpression(first) && ts.isArrayLiteralExpression(first.expression)) {
        for (const element of first.expression.elements) if (ts.isStringLiteral(element)) staticKeys.add(element.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const profileKeys = new Set();
const filename = 'lib/onboarding/supplier-profile.ts';
const profile = ts.createSourceFile(filename, await readFile(filename, 'utf8'), ts.ScriptTarget.Latest, true);
function collectPairs(node) {
  if (ts.isArrayLiteralExpression(node) && node.elements.length === 2 && node.elements.every(ts.isStringLiteral)) profileKeys.add(node.elements[0].text);
  ts.forEachChild(node, collectPairs);
}
function visitProfile(node) {
  if (ts.isCallExpression(node) && ['need', 'add'].includes(node.expression.getText(profile))) {
    const english = node.arguments[3];
    if (english && ts.isStringLiteral(english)) profileKeys.add(english.text);
  }
  if (ts.isPropertyAssignment(node) && node.name.getText(profile) === 'en' && ts.isStringLiteral(node.initializer)) profileKeys.add(node.initializer.text);
  if (ts.isVariableDeclaration(node) && ['steps', 'labels', 'section'].includes(node.name.getText(profile)) && node.initializer) collectPairs(node.initializer);
  ts.forEachChild(node, visitProfile);
}
visitProfile(profile);
for (const key of [...staticKeys, ...profileKeys, 'Company photo {number}', 'Remove photo {number}', 'check the format or length.'].filter(Boolean)) {
  assert.ok(dictionaries[key], `Missing supplier UI translation: ${key}`);
  assert.equal(dictionaries[key].length, 8, `${key}: eight translations available`);
  assert.ok(dictionaries[key].every(value => typeof value === 'string' && value.trim()), `${key}: no empty translations`);
}
console.log(`Supplier translations passed: ${Object.keys(supplier).length} dictionary rows, ${staticKeys.size} static UI keys and ${profileKeys.size} profile/validation keys covered in eight additional languages.`);
