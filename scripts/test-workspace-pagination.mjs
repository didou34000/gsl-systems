import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testWorkspacePagination(db){
 const buyer=randomUUID(),outsider=randomUUID();await db.exec('reset role');for(const id of [buyer,outsider])await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.invalid']);
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
 async function command(action,args){return (await db.query('select public.workflow($1,$2,$3) result',[action,JSON.stringify(args),randomUUID()])).rows[0].result}
 await as(buyer);const org=(await command('buyer_company',{name:'Synthetic pagination',country:'FR'})).organizationId;
 for(let i=0;i<25;i++)await command('save_rfq',{organization:org,title:'Synthetic draft '+i,details:'',destination:'FR',items:[]});
 const read=async page=>(await db.query('select public.workspace_requests($1,$2) result',[org,page])).rows[0].result;
 const first=await read(0),second=await read(1);assert.equal(first.total,25);assert.equal(first.rfqs.length,20);assert.equal(first.hasMore,true);assert.equal(second.rfqs.length,5);assert.equal(second.hasMore,false);assert.equal(new Set([...first.rfqs,...second.rfqs].map(x=>x.id)).size,25);
 const another=(await command('buyer_company',{name:'Separate purchasing company',country:'DE'})).organizationId;await command('save_rfq',{organization:another,title:'Other company draft',details:'',destination:'DE',items:[]});assert.equal((await read(0)).total,25);
 await assert.rejects(read(-1),/INVALID/);await as(outsider);await assert.rejects(read(0),/FORBIDDEN/);await db.exec('reset role;set role anon');await assert.rejects(read(0),/permission denied/);
 console.log('Workspace pagination: 25 drafts across two pages without duplicates, company scoping and outsider/anonymous denial passed.');
}
