/** Rough strength estimate shown under new passwords. It only guides the user:
 *  the server still enforces 12 to 128 characters, nothing more. */
const weakParts=['password','motdepasse','azerty','qwerty','123456','abcdef','gsl','admin','welcome','bonjour','soleil'];
export type PasswordStrength=0|1|2|3|4;
export function passwordStrength(password:string):PasswordStrength{
 if(password.length<12)return 0;
 const classes=[/[a-z]/,/[A-Z]/,/\d/,/[^A-Za-z0-9]/].filter(r=>r.test(password)).length;
 const distinct=new Set(password.toLowerCase()).size;
 let score=1;
 if(password.length>=16)score++;
 if(classes>=3)score++;
 if(password.length>=20||(classes===4&&password.length>=14))score++;
 const lower=password.toLowerCase();
 if(weakParts.some(part=>lower.includes(part))||/(.)\1{3,}/.test(password)||distinct<6)score--;
 return Math.max(1,Math.min(4,score)) as PasswordStrength;
}
