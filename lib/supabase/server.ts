import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {runtimeConfig} from '@/lib/runtime-config';
export async function authClient() {
  const jar = await cookies();
  const {url,key}=runtimeConfig();
  return createServerClient(url, key, {
    cookieOptions: {httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV==='production', path:'/'},
    cookies: {
      getAll:()=>jar.getAll(),
      setAll:values=>{for(const {name,value,options} of values) jar.set(name,value,options);},
    },
  });
}
