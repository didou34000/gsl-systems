import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
// Public project credentials only. RLS applies to every database request.
export const supabaseUrl = 'https://ihugldueruspxdyooycc.supabase.co';
const publishableKey = 'sb_publishable_k8yUvFXkHGAzDvYeorUyVQ_AXcqoDyZ';
export async function authClient() {
  const jar = await cookies();
  return createServerClient(supabaseUrl, publishableKey, {
    cookieOptions: {httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV==='production', path:'/'},
    cookies: {
      getAll:()=>jar.getAll(),
      setAll:values=>{for(const {name,value,options} of values) jar.set(name,value,options);},
    },
  });
}
