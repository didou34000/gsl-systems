export function safeNext(value:unknown):string {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')) return '/compte';
  let decoded=value;
  try{for(let i=0;i<3;i++)decoded=decodeURIComponent(decoded)}catch{return '/compte'}
  if(/[\\\x00-\x20]/.test(decoded)||decoded.startsWith('//')||/%[0-9a-f]{2}/i.test(decoded))return '/compte';
  const url=new URL(decoded,'https://app.local');
  if(url.origin!=='https://app.local'||/^\/(auth|api|connexion|confirmer-email|inscription|mot-de-passe|nouveau-mot-de-passe|signin|signout)/.test(url.pathname))return '/compte';
  return url.pathname+url.search;
}

export function allowedOrigin(request:Request):string|null {
  const origin=request.headers.get('origin');
  const trusted=['https://www.gsl-systems.com','https://gsl-systems.com','https://gsl-systems.vercel.app'];
  if(process.env.GSL_SITE_URL)trusted.push(new URL(process.env.GSL_SITE_URL).origin);
  if(process.env.NODE_ENV!=='production')trusted.push('http://localhost:5173','http://localhost:5180','http://localhost:5181','http://localhost:5188');
  return origin&&trusted.includes(origin)?origin:null;
}
export function validPassword(value:unknown):value is string {return typeof value==='string'&&value.length>=12&&value.length<=128;}
