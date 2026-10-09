import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testCompanyPublication(db){
 const owner=randomUUID(),other=randomUUID(),unconfirmed=randomUUID();
 await db.exec('reset role');for(const id of [owner,other,unconfirmed])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,id+'@example.invalid',id===unconfirmed?null:new Date().toISOString()]);
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
 const p={legalName:'Immediate test company',country:'TR',activity:'manufacturer',description:'A synthetic company with essential information only.',headquarters:{city:'Bursa'},contact:{name:'Test contact',email:'private@example.invalid'},attestation:true,certificates:[{name:'Unfinished certificate'}],products:[{name:'Unfinished product'}],sites:[{}],website:'https://'};
 const publish=async(profile,revision)=>(await db.query('select public.publish_supplier_basics($1,$2) value',[JSON.stringify(profile),revision])).rows[0].value;
 await as(unconfirmed);await assert.rejects(publish(p,0),/LOGIN_REQUIRED/);
 await as(owner);await assert.rejects(publish({...p,legalName:''},0),/INCOMPLETE/);
 let a=await publish(p,0);const org=a.organization_id;assert.ok(org);assert.equal(a.status,'draft','published company remains editable');
 let pub=(await db.query('select * from public.published_supplier_profiles where organization_id=$1',[org])).rows[0];assert.equal(pub.public_details.verification,'unverified');assert.ok(!JSON.stringify(pub).includes('private@example.invalid'));assert.ok(!JSON.stringify(pub).includes('Unfinished'));assert.equal((await db.query('select * from public.published_products where organization_id=$1',[org])).rows.length,0);
 await db.exec('reset role');const product=randomUUID();await db.query('insert into public.products(id,organization_id,name,category,description,model_reference) values($1,$2,$3,$4,$5,$6)',[product,org,'Existing product','metal','Previously published product',product]);await db.query("update public.products set specifications='{\"manufacturing_country\":\"TR\"}' where id=$1",[product]);await db.query('insert into public.published_products(product_id,organization_id,source_revision,name,category,description,specifications) select id,organization_id,revision,name,category,description,specifications from public.products where id=$1',[product]);await as(owner);
 const reservation=(await db.query('select public.manage_upload($1,$2) value',['reserve',JSON.stringify({kind:'certificate',name:'unfinished.pdf',size:20,extension:'pdf'})])).rows[0].value;assert.ok(reservation.id);
 a=await publish({...p,description:'Updated public description with documents still missing.'},a.revision);assert.equal(a.organization_id,org,'same company on later edits');assert.equal((await db.query('select * from public.published_products where product_id=$1 and withdrawn_at is null',[product])).rows.length,1,'editing company keeps previously published products online');
 await assert.rejects(publish(p,1),/CONFLICT/);
 await as(other);await assert.rejects(publish(p,a.revision),/CONFLICT/);assert.equal((await db.query('select * from public.supplier_applications where owner_id=$1',[owner])).rows.length,0);
 await db.exec('reset role; set role anon');pub=(await db.query('select * from public.published_supplier_profiles where organization_id=$1',[org])).rows[0];assert.equal(pub.public_details.verification,'unverified');await assert.rejects(publish(p,0),/permission denied/);
 await as(owner);await db.exec('reset role');await db.query('update public.published_supplier_profiles set withdrawn_at=now() where organization_id=$1',[org]);await as(owner);await assert.rejects(publish(p,a.revision),/LOCKED/);
 await db.exec('reset role');console.log('Immediate company publication: essentials, unverified public badge, private optional data, unfinished upload, repeat edits, revision/owner isolation, anonymous denial and withdrawal protection passed.');
}
