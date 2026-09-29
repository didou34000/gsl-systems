/** Server configuration: no production fallback for development or tests. */
export function runtimeConfig(env:NodeJS.ProcessEnv=process.env){
 const url=env.SUPABASE_URL;const key=env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('SUPABASE_CONFIGURATION_MISSING');
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))throw new Error('SUPABASE_URL_INVALID');
 const stage=env.GSL_ENVIRONMENT;
 if(!['development','test','preview','production'].includes(stage||''))throw new Error('GSL_ENVIRONMENT_MISSING');
 if(stage!=='production'&&parsed.hostname==='ihugldueruspxdyooycc.supabase.co')throw new Error('PRODUCTION_DATABASE_REFUSED');
 if(['production','preview'].includes(stage||'')&&!env.GSL_SITE_URL)throw new Error('GSL_SITE_URL_MISSING');
 const siteUrl=env.GSL_SITE_URL||'http://localhost:5173';const site=new URL(siteUrl);if(site.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(site.hostname))throw new Error('GSL_SITE_URL_INVALID');
 return {url:parsed.origin,key,stage,siteUrl:site.origin};
}
