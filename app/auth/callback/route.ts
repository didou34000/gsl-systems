import {isLanguage} from '@/lib/i18n/languages';
import {NextResponse} from 'next/server';
import {safeNext} from '@/lib/auth-policy';
import {authClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get('code');
 const destination=url.searchParams.get('flow')==='recovery'?'/nouveau-mot-de-passe?next='+encodeURIComponent(safeNext(url.searchParams.get('next'))):safeNext(url.searchParams.get('next'));
 let ok=false;
 if(code){try{const db=await authClient();const {error}=await db.auth.exchangeCodeForSession(code);ok=!error}catch{}}
 const response=NextResponse.redirect(new URL(ok?destination:'/connexion?error=confirmation&next='+encodeURIComponent(safeNext(url.searchParams.get('next'))),url.origin));
 if(isLanguage(url.searchParams.get('lang')))response.cookies.set('gsl-language',url.searchParams.get('lang')!,{path:'/',sameSite:'lax',maxAge:31536000});
 response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');
 return response;
}
