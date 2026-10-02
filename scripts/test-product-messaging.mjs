import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testProductMessaging(db,{buyer,other,supplier,org,supplierOrg}){
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
 const send=(company,product,conversation,body,key=randomUUID())=>db.query('select public.send_product_message($1,$2,$3,$4,$5) result',[company,product,conversation,body,key]).then(r=>r.rows[0].result);
 await as(buyer);
 const product=(await db.query('select product_id from public.published_products where organization_id=$1 and withdrawn_at is null',[supplierOrg])).rows[0].product_id;
 const key=randomUUID(),first=await send(org,product,null,'Synthetic product question',key);
 assert.deepEqual(await send(org,product,null,'Synthetic product question',key),first);
 await assert.rejects(send(org,product,null,'Changed retry',key),/IDEMPOTENCY_CONFLICT/);
 assert.equal((await send(org,product,null,'Second question')).conversation,first.conversation);
 await assert.rejects(send(org,randomUUID(),null,'Unavailable'),/NOT_PUBLISHED/);
 await assert.rejects(db.query('insert into public.product_messages(conversation_id,sender_organization_id,sender_user_id,body,command_id) values($1,$2,$3,$4,$5)',[first.conversation,org,buyer,'Bypass',randomUUID()]));
 await as(other);
 assert.equal((await db.query('select * from public.product_conversations')).rows.length,0);
 assert.equal((await db.query('select * from public.product_messages')).rows.length,0);
 await assert.rejects(send(org,null,first.conversation,'Intrusion'),/FORBIDDEN/);
 await as(supplier);
 await assert.rejects(send(supplierOrg,product,null,'Own product'),/OWN_PRODUCT/);
 await assert.rejects(send(org,null,first.conversation,'Impersonation'),/FORBIDDEN/);
 await send(supplierOrg,null,first.conversation,'Synthetic manufacturer reply');
 assert.equal((await db.query('select * from public.product_messages')).rows.length,3);
 await as(buyer);
 assert.equal((await db.query('select * from public.product_messages')).rows.length,3);
 // A product withdrawal must stop new enquiries without destroying existing correspondence.
 await db.exec('reset role');await db.query('update public.published_products set withdrawn_at=now() where product_id=$1',[product]);
 await as(buyer);await assert.rejects(send(org,product,null,'New enquiry'),/NOT_PUBLISHED/);
 await send(org,null,first.conversation,'Existing conversation remains usable');
 await db.exec('reset role');await db.query('update public.published_products set withdrawn_at=null where product_id=$1',[product]);
 await db.query('update public.memberships set active=false where organization_id=$1 and user_id=$2',[org,buyer]);
 await as(buyer);assert.equal((await db.query('select * from public.product_messages')).rows.length,0);
 await assert.rejects(send(org,null,first.conversation,'Revoked access'),/FORBIDDEN/);
 await db.exec('reset role');await db.query('update public.memberships set active=true where organization_id=$1 and user_id=$2',[org,buyer]);
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.product_messages'));
 await db.exec('reset role');
 console.log('Product messaging: buyer/manufacturer exchange, idempotency, isolation, impersonation, revoked access and product withdrawal passed.');
}
