import {isLanguage} from '@/lib/i18n/languages';
import {z} from 'zod';
import {allowedOrigin} from '@/lib/auth-policy';
import {publicCatalogue} from '@/lib/supabase/public-catalogue';
// Newsletter sign-ups are recorded as contact requests so the operator sees them in the inbox
// until a mailing provider is connected. Consent is required and stated in the stored message.
const schema=z.object({request_id:z.string().uuid(),email:z.string().email().max(254),consent:z.literal(true),language:z.string().refine(isLanguage),website:z.literal('').optional()}).strict();
export async function POST(request:Request){const headers={'Cache-Control':'private, no-store'};if(!allowedOrigin(request))return Response.json({error:'ORIGIN'},{status:403,headers});try{const raw=await request.text();if(raw.length>2000)return Response.json({error:'INVALID'},{status:413,headers});const p=schema.safeParse(JSON.parse(raw));if(!p.success)return Response.json({error:'INVALID'},{status:422,headers});const {request_id,email,language}=p.data;const {error}=await publicCatalogue().rpc('submit_contact',{request_id,email,name:'Newsletter',subject:'Inscription à la newsletter',body:'Inscription à la newsletter GSL systems depuis le pied de page, avec consentement explicite à recevoir les actualités par e-mail.',language});if(error)return Response.json({error:error.message.includes('RATE_LIMITED')?'RATE_LIMITED':'UNAVAILABLE'},{status:error.message.includes('RATE_LIMITED')?429:503,headers});return Response.json({ok:true},{headers})}catch{return Response.json({error:'UNAVAILABLE'},{status:503,headers})}}
