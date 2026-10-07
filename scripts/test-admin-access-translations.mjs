import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const loadModule=async path=>{
 const source=await readFile(path,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
};
const {accessEnglish,accessTranslations,accessTranslate,accessTranslationKeys,accessTranslationCoverage,accessLanguageOrder,accessRoleKeys,accessRoleDescriptionKeys,accessPermissionKeys}=await loadModule('lib/admin/access-translations.ts');
const {adminRoles,adminPermissions,rolePermissions}=await loadModule('lib/admin/permissions.ts');
const locales=['en',...accessLanguageOrder];
assert.equal(locales.length,10);
assert.equal(new Set(locales).size,10);
assert.deepEqual(Object.keys(accessTranslations).sort(),[...accessTranslationKeys].sort(),'No missing or extraneous dictionary keys');
for(const key of accessTranslationKeys){
 assert.ok(accessEnglish[key].trim(),key+' has an empty English label');
 assert.equal(accessTranslations[key].length,9,key+' requires nine additional translations');
 for(const value of accessTranslations[key])assert.ok(typeof value==='string'&&value.trim(),key+' has an empty translation');
}
for(const locale of locales){
 assert.equal(accessTranslationCoverage[locale],accessTranslationKeys.length,locale+' is incomplete');
 for(const key of accessTranslationKeys)assert.ok(accessTranslate(locale,key).trim(),locale+'.'+key+' is empty');
}
assert.equal(accessTranslate('unknown','access'),'Access & data');
assert.equal(accessTranslate('__proto__','access'),'Access & data');
assert.equal(accessTranslate('fr','access'),'Accès et données');
assert.equal(accessTranslate('ar','roleOwner'),'المالك');
assert.equal(accessTranslate('zh','permissionExport'),'导出获准数据');
assert.equal(accessTranslate('fr','exportStarted'),'Téléchargement démarré');

// Every server-defined role and permission must have a human-facing label.
assert.deepEqual(Object.keys(accessRoleKeys).sort(),[...adminRoles].sort());
assert.deepEqual(Object.keys(accessRoleDescriptionKeys).sort(),[...adminRoles].sort());
assert.deepEqual(Object.keys(accessPermissionKeys).sort(),[...adminPermissions].sort());
for(const locale of locales){
 for(const role of adminRoles){assert.ok(accessTranslate(locale,accessRoleKeys[role]).trim());assert.ok(accessTranslate(locale,accessRoleDescriptionKeys[role]).trim());}
 for(const permission of adminPermissions)assert.ok(accessTranslate(locale,accessPermissionKeys[permission]).trim());
}
// The explanatory role copy is coupled to these product capabilities. A role
// policy change must trigger an explicit wording review instead of silent drift.
assert.deepEqual(rolePermissions.analyst,['overview.read','catalog.read','activity.read']);
assert.deepEqual(rolePermissions.operator,['overview.read','catalog.read','contacts.read','contacts.manage','tasks.manage','activity.read']);
assert.deepEqual(rolePermissions.admin,['overview.read','catalog.read','contacts.read','contacts.manage','tasks.manage','activity.read','data.export']);
assert.deepEqual(new Set(rolePermissions.owner),new Set(adminPermissions));
assert.match(accessEnglish.accessConfirmedOnly,/existing account.*confirmed email/);
assert.match(accessEnglish.accessTargetMissing,/No eligible account/,'Both missing and unconfirmed emails use a generic message');
assert.match(accessEnglish.accessRevokeEffect,/subsequent protected requests/);
assert.match(accessEnglish.accessRevokeEffect,/cannot erase data already viewed, copied or downloaded/);
assert.match(accessEnglish.exportSeparatePermission,/does not prevent.*copying/);
assert.match(accessEnglish.exportScope,/5,000/);
assert.match(accessEnglish.exportScope,/searches and filters do not narrow/);
assert.match(accessEnglish.accessReasonHelp,/10–500/);
assert.match(accessEnglish.dataPrivateNote,/No dashboard role grants access/);

// Check keys actually used in the permission panel and dashboard, so a new
// control cannot silently ship with untranslated text in any supported locale.
let callSites=0;
const lookupErrors=new Map();
for(const file of ['app/admin-access-panel.tsx','app/admin-dashboard.tsx']){
 const source=await readFile(file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const keys=new Set(accessTranslationKeys);
 function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='at'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){
   assert.ok(keys.has(node.arguments[0].text),file+' references an untranslated access label: '+node.arguments[0].text);callSites++;
  }
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='dataCategories'&&node.initializer&&ts.isArrayLiteralExpression(node.initializer)){
   for(const category of node.initializer.elements){
    if(!ts.isObjectLiteralExpression(category))continue;
    for(const field of category.properties)if(ts.isPropertyAssignment(field)&&['label','note'].includes(field.name.getText(ast))&&ts.isStringLiteral(field.initializer))assert.ok(keys.has(field.initializer.text),file+' has an untranslated data category: '+field.initializer.text);
   }
  }
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='errorKeys'&&node.initializer&&ts.isObjectLiteralExpression(node.initializer)){
   for(const entry of node.initializer.properties)if(ts.isPropertyAssignment(entry)&&ts.isStringLiteral(entry.initializer)){
    assert.ok(keys.has(entry.initializer.text),'Untranslated access error: '+entry.initializer.text);
    lookupErrors.set(entry.name.getText(ast),entry.initializer.text);
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);
}
assert.equal(lookupErrors.get('USER_NOT_FOUND'),'accessTargetMissing');
assert.equal(lookupErrors.get('EMAIL_UNCONFIRMED'),'accessTargetMissing','Unconfirmed accounts must use the same generic lookup result');
console.log(`Access wording passed: ${accessTranslationKeys.length} keys × ${locales.length} languages, four roles, eight permissions, ${callSites} UI call sites, export/revocation boundaries and generic account lookup errors.`);
