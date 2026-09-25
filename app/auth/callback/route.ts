import {NextResponse} from 'next/server';
import {authClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get('code');
 const destination=url.searchParams.get('flow')==='recovery'?'/nouveau-mot-de-passe':'/compte?confirmed=1';
 let ok=false;
 if(code){try{const db=await authClient();const {error}=await db.auth.exchangeCodeForSession(code);ok=!error}catch{}}
 const response=NextResponse.redirect(new URL(ok?destination:'/connexion?error=confirmation',url.origin));
 response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');
 return response;
}
