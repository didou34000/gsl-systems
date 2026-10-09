import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testSourcingScope(db){
 const countries=['TR','MA','TN','RS','MK','BA','MD','GE','AL','EG'];
 await db.exec('reset role');
 const owner=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[owner,'scope@example.invalid']);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.exec('set role authenticated');
 const profile={legalName:'Scope fixture',country:'TR',activity:'manufacturer',description:'Manufacturing company for isolated scope tests.',headquarters:{city:'Test city'},contact:{name:'Test',email:'scope@example.invalid'},attestation:true,products:[],sites:[]};
 const publish=async(p,revision)=>(await db.query('select public.publish_supplier_basics($1,$2) result',[JSON.stringify(p),revision])).rows[0].result;
 // Country restrictions cannot be bypassed by calling the publication RPC directly.
 for(const country of ['FR','CN','AQ'])await assert.rejects(publish({...profile,country},0),/COUNTRY_OUTSIDE_SCOPE/);
 let app=await publish(profile,0);
 const org=app.organization_id;
 for(const country of countries){app=await publish({...profile,country},app.revision);assert.equal((await db.query('select country_code from public.published_supplier_profiles where organization_id=$1',[org])).rows[0].country_code,country);}
 await db.exec('reset role');
 const row=(await db.query('select * from public.published_supplier_profiles where organization_id=$1',[org])).rows[0];assert.ok(row);
 await assert.rejects(db.query("update public.published_supplier_profiles set manufacturing_countries=array['FR'] where organization_id=$1",[org]),/COUNTRY_OUTSIDE_SCOPE/);
 await db.exec('set role authenticated');
 await assert.rejects(db.query("update public.supplier_applications set status='submitted',payload=$1 where owner_id=$2",[JSON.stringify({...profile,sites:[{address:{country:'FR'}}]}),owner]),/COUNTRY_OUTSIDE_SCOPE/);
 await db.exec('reset role');
 // Simulate pre-migration data without changing its country or deleting its private draft.
 await db.exec('alter table public.published_supplier_profiles disable trigger enforce_supplier_country');
 await db.query("update public.published_supplier_profiles set country_code='BE' where organization_id=$1",[org]);
 await db.exec('alter table public.published_supplier_profiles enable trigger enforce_supplier_country;set role anon');
 assert.equal((await db.query('select * from public.published_supplier_profiles where organization_id=$1',[org])).rows.length,0);
 const search=(await db.query("select public.search_catalogue('{\"page\":1,\"priority\":\"required\",\"unknown\":\"include\"}') result")).rows[0].result;
 assert.ok(!search.suppliers.some(s=>s.organization_id===org));
 await db.exec('reset role;set role authenticated');
 assert.equal((await db.query('select * from public.supplier_applications where owner_id=$1',[owner])).rows.length,1,'owner retains private data');
 await db.query("update public.supplier_applications set status='draft',payload=jsonb_set(payload,'{country}','\"BE\"') where owner_id=$1",[owner]);
 assert.equal((await db.query('select payload from public.supplier_applications where owner_id=$1',[owner])).rows[0].payload.country,'BE','legacy draft remains editable');
 await assert.rejects(db.query("update public.supplier_applications set status='submitted' where owner_id=$1",[owner]),/COUNTRY_OUTSIDE_SCOPE/);
 await db.exec('reset role');
 console.log('Sourcing scope: ten countries accepted, direct publication/submission bypass blocked, legacy listing hidden from REST/search while private draft remains editable.');
}
