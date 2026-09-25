export function safeNext(value:unknown):string {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')) return '/compte';
  const url=new URL(value,'https://app.local');
  if(url.origin!=='https://app.local'||/^\/(auth|api|connexion|inscription|mot-de-passe|nouveau-mot-de-passe|signin|signout)/.test(url.pathname)) return '/compte';
  return url.pathname+url.search;
}
export function allowedOrigin(request:Request):string|null {
  const origin=request.headers.get('origin');
  const trusted=['https://www.gsl-systems.com','https://gsl-systems.com','https://gsl-systems.vercel.app'];
  if(process.env.NODE_ENV!=='production')trusted.push('http://localhost:5173','http://localhost:5180','http://localhost:5181');
  return origin&&trusted.includes(origin)?origin:null;
}
export function validPassword(value:unknown):value is string {return typeof value==='string'&&value.length>=12&&value.length<=128;}
