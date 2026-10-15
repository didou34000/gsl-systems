import {authClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';

/** What the account already knows for "Décrire mon besoin": the signed-in user, the company typed at sign-up
 *  and the companies this user may save a request to (or enable for purchasing). Never another member's contact data. */
export async function GET(){try{
 const db=await authClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return json({error:'LOGIN_REQUIRED'},401);
 if(!user.email_confirmed_at)return json({error:'CONFIRM_EMAIL'},401);
 const [memberships,profile]=await Promise.all([db.from('memberships').select('organization_id,role').eq('user_id',user.id).eq('active',true).limit(100),db.from('profiles').select('display_name').eq('user_id',user.id).maybeSingle()]);
 if(memberships.error)return json({error:'UNAVAILABLE'},503);
 const roles=new Map((memberships.data||[]).map(m=>[m.organization_id as string,m.role as string]));
 const organizations=roles.size?await db.from('organizations').select('id,legal_name,country_code,buyer,supplier').in('id',[...roles.keys()]).order('legal_name'):{data:[],error:null};
 if(organizations.error)return json({error:'UNAVAILABLE'},503);
 const m=user.user_metadata||{};const country=text(m.company_country,2);
 return json({
  user:{id:user.id,email:user.email||'',name:text(profile.data?.display_name,160)||text(m.display_name,160)},
  signup:{name:text(m.company_name,160),country:/^[A-Z]{2}$/.test(country)?country:''},
  organizations:(organizations.data||[]).map(o=>{const role=roles.get(o.id)||'';return {id:o.id,legal_name:o.legal_name,country_code:o.country_code,buyer:!!o.buyer,role,canRequest:!!o.buyer&&['owner','admin','procurement'].includes(role),canEnableBuyer:!o.buyer&&['owner','admin'].includes(role)}}),
 });
}catch{return json({error:'UNAVAILABLE'},503)}}
