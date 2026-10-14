import {resolveLanguage} from '@/lib/i18n/languages';
import {authClient} from '@/lib/supabase/server';
import {allowedOrigin,safeNext,validPassword} from '@/lib/auth-policy';
import {countryCodes} from '@/lib/onboarding/iso-countries';
import {isSourcingCountry} from '@/lib/sourcing-coverage';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 try{
  const db=await authClient(); const {data:{user},error}=await db.auth.getUser();
  if(error||!user)return json({user:null});
  const {data:profile,error:profileError}=await db.from('profiles').select('display_name,language').eq('user_id',user.id).maybeSingle();
  if(profileError)return json({error:'PROFILE_UNAVAILABLE'},503);
  return json({user:{email:user.email,name:profile?.display_name||user.user_metadata?.display_name||'',confirmed:!!user.email_confirmed_at,language:resolveLanguage(profile?.language||user.user_metadata?.language)}});
 }catch{return json({error:'UNAVAILABLE'},503)}
}
export async function POST(request:Request){
 const origin=allowedOrigin(request); if(!origin)return json({error:'ORIGIN'},403);
 const raw=await request.text(); if(raw.length>6000)return json({error:'INVALID'},400);
 let body;try{body=JSON.parse(raw)}catch{return json({error:'INVALID'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'INVALID'},400);
 const action=body.action;const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 const emailAction=['signup','login','reset','resend','verify'].includes(action);
 if(emailAction&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return json({error:'EMAIL'},400);
 if(['signup','password'].includes(action)&&!validPassword(body.password))return json({error:'PASSWORD'},400);
 if(action==='verify'&&(typeof body.code!=='string'||!/^\d{8}$/.test(body.code)||!['signup','recovery'].includes(body.flow)))return json({error:'CODE_INVALID'},400);
 if(action==='login'&&(typeof body.password!=='string'||body.password.length>128||!body.password))return json({error:'CREDENTIALS'},400);
 try {
  const db=await authClient();
  const callback=new URL('/auth/callback',origin);
  callback.searchParams.set('next',safeNext(body.next));
  callback.searchParams.set('lang',resolveLanguage(body.language));
  let error:{code?:string;status?:number;message:string}|null=null;
  if(action==='signup'){
   if(typeof body.name!=='string'||body.name.trim().length<2||body.name.length>100)return json({error:'NAME'},400);
   // The sign-up asks for the company: its name doubles as the display name until a person's name is set.
   if(typeof body.country!=='string'||!countryCodes.includes(body.country)||(body.purpose==='supplier'&&!isSourcingCountry(body.country)))return json({error:'COUNTRY'},400);
   const legalForm=typeof body.legalForm==='string'?body.legalForm.trim().slice(0,120):'';
   ({error}=await db.auth.signUp({email,password:body.password,options:{emailRedirectTo:callback.toString(),data:{display_name:body.name.trim(),language:resolveLanguage(body.language),company_name:body.name.trim(),company_country:body.country,company_legal_form:legalForm}}}));
  }else if(action==='verify'){
   ({error}=await db.auth.verifyOtp({email,token:body.code,type:body.flow==='recovery'?'recovery':'email'}));
   if(!error)return json({ok:true,next:body.flow==='recovery'?'/nouveau-mot-de-passe?next='+encodeURIComponent(safeNext(body.next)):safeNext(body.next)==='/compte'?'/compte?confirmed=1':safeNext(body.next)});
  }else if(action==='login'){
   ({error}=await db.auth.signInWithPassword({email,password:body.password}));
   if(!error)return json({ok:true,next:safeNext(body.next)});
  }else if(action==='reset'){
   ({error}=await db.auth.resetPasswordForEmail(email,{redirectTo:callback.toString()+'&flow=recovery'}));
  }else if(action==='resend'){
   ({error}=await db.auth.resend({type:'signup',email,options:{emailRedirectTo:callback.toString()}}));
  }else if(action==='logout'){
   ({error}=await db.auth.signOut({scope:'local'}));
  }else if(action==='password'||action==='profile'){
   const {data:{user}}=await db.auth.getUser();if(!user||!user.email_confirmed_at)return json({error:'LOGIN_REQUIRED'},401);
   if(action==='password'){
    // With an authenticator enrolled, Supabase only changes the password of an aal2 session.
    // A recovery code gives aal1, so the current authenticator code is checked first.
    const level=await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if(level.error)return json({error:'UNAVAILABLE'},503);
    if(level.data.nextLevel==='aal2'&&level.data.currentLevel!=='aal2'){
     if(typeof body.mfaCode!=='string'||!/^\d{6}$/.test(body.mfaCode))return json({error:'MFA_REQUIRED'},403);
     const factors=await db.auth.mfa.listFactors();
     const factor=factors.data?.totp.find(f=>f.status==='verified');
     if(factors.error||!factor)return json({error:'UNAVAILABLE'},503);
     const verified=await db.auth.mfa.challengeAndVerify({factorId:factor.id,code:body.mfaCode});
     if(verified.error)return verified.error.status===429?json({error:'RATE_LIMIT'},429):json({error:'MFA_CODE'},400);
    }
    ({error}=await db.auth.updateUser({password:body.password}));
   }
   else{
    if(typeof body.name!=='string'||body.name.trim().length<2||body.name.length>100)return json({error:'NAME'},400);
    const {data:existing,error:readError}=await db.from('profiles').select('user_id').eq('user_id',user.id).maybeSingle();
    if(readError)return json({error:'UNAVAILABLE'},503);
    const profile={display_name:body.name.trim(),language:resolveLanguage(body.language)};
    ({error}=existing?await db.from('profiles').update(profile).eq('user_id',user.id):await db.from('profiles').insert({user_id:user.id,...profile}));
    // Keep the sign-up metadata in step so every screen shows the same name.
    if(!error)({error}=await db.auth.updateUser({data:{display_name:profile.display_name,language:profile.language}}));
   }
  }else return json({error:'INVALID'},400);
  if(error){
   if(error.status===429||error.code?.includes('rate_limit'))return json({error:'RATE_LIMIT'},429);
   if(action==='verify')return json({error:'CODE_INVALID'},400);
   if(error.code==='email_not_confirmed')return json({error:'CONFIRM_EMAIL'},400);
   if(action==='login')return json({error:'CREDENTIALS'},400);
   if(error.code==='same_password')return json({error:'SAME_PASSWORD'},400);
   if(error.code==='weak_password')return json({error:'PASSWORD'},400);
   if(error.code==='insufficient_aal')return json({error:'MFA_REQUIRED'},403);
   // Never disclose account existence or echo provider/SMTP internals.
   if(['user_already_exists','email_exists'].includes(error.code||''))return json({ok:true});
   return json({error:emailAction?'EMAIL_UNAVAILABLE':'UNAVAILABLE'},503);
  }
  return json({ok:true});
 }catch{return json({error:'UNAVAILABLE'},503)}
}
