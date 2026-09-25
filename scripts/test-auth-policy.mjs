import assert from 'node:assert/strict';
import {safeNext,allowedOrigin,validPassword} from '../lib/auth-policy.ts';
for(const candidate of ['https://attacker.test','//attacker.test','/\\attacker.test','/auth/callback','/api/auth','/connexion',null])assert.equal(safeNext(candidate),'/compte');
assert.equal(safeNext('/demande-de-devis?demo=pieces-usinees-cnc'),'/demande-de-devis?demo=pieces-usinees-cnc');
assert.equal(allowedOrigin(new Request('https://www.gsl-systems.com/api/auth',{headers:{origin:'https://attacker.test'}})),null);
assert.equal(allowedOrigin(new Request('https://www.gsl-systems.com/api/auth')),null);
assert.equal(allowedOrigin(new Request('https://www.gsl-systems.com/api/auth',{headers:{origin:'https://www.gsl-systems.com'}})),'https://www.gsl-systems.com');
assert.equal(validPassword('short'),false);assert.equal(validPassword('a'.repeat(129)),false);assert.equal(validPassword('a distinct long phrase'),true);
console.log('Auth policy: redirect injection, cross-origin requests and password bounds passed.');
