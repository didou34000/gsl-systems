import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {isLanguage} from './lib/i18n/languages';
import {runtimeConfig} from './lib/runtime-config';
export async function proxy(request:NextRequest){
 const language=request.nextUrl.searchParams.get('lang');if(isLanguage(language))request.cookies.set('gsl-language',language);
 const requestHeaders=new Headers(request.headers);requestHeaders.set('cookie',request.cookies.toString());requestHeaders.set('x-gsl-path',request.nextUrl.pathname);requestHeaders.set('x-gsl-filtered',[...request.nextUrl.searchParams.keys()].some(k=>k!=='lang')?'true':'false');
 let response=NextResponse.next({request:{headers:requestHeaders}});
 try{
  const {url,key}=runtimeConfig();
  const db=createServerClient(url,key,{
   cookieOptions:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'},
   cookies:{getAll:()=>request.cookies.getAll(),setAll:values=>{
    values.forEach(({name,value})=>request.cookies.set(name,value));
    requestHeaders.set('cookie',request.cookies.toString());response=NextResponse.next({request:{headers:requestHeaders}});
    values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   }},
  });
  await db.auth.getUser();
 }catch{/* API handlers fail closed with an unavailable state when configuration is absent. */}
 if(isLanguage(language))response.cookies.set('gsl-language',language,{sameSite:'lax',path:'/',maxAge:31536000});
 response.headers.set('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");response.headers.set('X-Frame-Options','DENY');response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Content-Type-Options','nosniff');
 response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/((?!_next/static|_next/image|images/|brand/|flags/|favicon|.*\\.(?:png|jpg|webp|svg|mp4|woff2)$).*)']};
