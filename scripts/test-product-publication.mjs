import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testProductPublication(db){
 const owner=randomUUID(),other=randomUUID();await db.exec('reset role');for(const id of [owner,other])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
 const profile={legalName:'Synthetic immediate product maker',country:'TR',activity:'manufacturer',description:'Synthetic company to test instant product publication.',headquarters:{city:'Bursa'},contact:{name:'Contact',email:'private@example.invalid'},attestation:true,products:[],certificates:[{name:'Private unfinished certificate'}]};
 const company=async rev=>(await db.query('select public.publish_supplier_basics($1,$2) value',[JSON.stringify(profile),rev])).rows[0].value;
 const publish=async(p,rev)=>(await db.query('select public.publish_supplier_products($1,$2) value',[JSON.stringify(p),rev])).rows[0].value;
 await as(owner);let a=await company(0);const org=a.organization_id;
 profile.legalName='Private unsaved company edit';profile.contact.email='unfinished';
 const source=randomUUID();profile.products=[{id:source,listingStatus:'publish',name:'CNC part',category:'metal',description:'A metal component manufactured to customer drawings.',origin:'TR',ce:'required',documentId:'',reference:'First reference'},{id:randomUUID(),listingStatus:'draft',name:'Unfinished draft'}];
 await db.query('select public.manage_upload($1,$2)',['reserve',JSON.stringify({kind:'technical',name:'incomplete.pdf',size:12,extension:'pdf'})]);
 await assert.rejects(publish({...profile,products:[{...profile.products[0],origin:'FR'}]},a.revision),/COUNTRY_OUTSIDE_SCOPE/);
 a=await publish(profile,a.revision);assert.equal(a.published_count,1);let rows=(await db.query('select * from public.published_products where organization_id=$1 and withdrawn_at is null',[org])).rows;assert.equal(rows.length,1);const product=rows[0].product_id;
 assert.equal(rows[0].specifications.compliance,'not_assessed');assert.equal(rows[0].specifications.verification,'unverified');assert.ok(!JSON.stringify(rows).includes('documentId'));assert.equal((await db.query('select display_name from public.published_supplier_profiles where organization_id=$1',[org])).rows[0].display_name,'Synthetic immediate product maker','product publication does not publish company edits');
 profile.products[0].reference='Changed reference';profile.products[0].name='Updated CNC part';a=await publish(profile,a.revision);rows=(await db.query('select * from public.published_products where organization_id=$1 and withdrawn_at is null',[org])).rows;assert.equal(rows.length,1);assert.equal(rows[0].product_id,product,'public URL survives changing reference');assert.equal(rows[0].name,'Updated CNC part');
 await assert.rejects(publish({...profile,products:[{...profile.products[0],description:''}]},a.revision),/INCOMPLETE/);assert.equal((await db.query('select name from public.published_products where product_id=$1',[product])).rows[0].name,'Updated CNC part');
 await assert.rejects(publish(profile,1),/CONFLICT/);
 profile.products[0].listingStatus='draft';a=await publish(profile,a.revision);assert.equal(a.published_count,0);assert.equal((await db.query('select * from public.published_products where product_id=$1',[product])).rows.length,0,'private draft disappears from public catalogue');
 profile.products[0].listingStatus='publish';a=await publish(profile,a.revision);assert.equal((await db.query('select product_id from public.published_products where organization_id=$1',[org])).rows[0].product_id,product);
 await as(other);await db.query("insert into public.supplier_applications(owner_id,payload,status) values(auth.uid(),$1,'draft')",[JSON.stringify(profile)]);await assert.rejects(publish(profile,1),/COMPANY_REQUIRED/);await assert.rejects(db.query('select * from private.supplier_product_links'),/permission denied/);
 await db.exec('reset role;set role anon');assert.equal((await db.query('select * from public.published_products where product_id=$1',[product])).rows.length,1);await assert.rejects(publish(profile,a.revision),/permission denied/);
 await as(owner);await db.exec('reset role');await db.query('update public.published_supplier_profiles set withdrawn_at=now() where organization_id=$1',[org]);await as(owner);await assert.rejects(publish(profile,a.revision),/COMPANY_REQUIRED/);
 await db.exec('reset role');console.log('Immediate products: optional documents, incomplete private company edits, stable URL, atomic validation, drafts, re-publication, ownership, anonymous denial and company withdrawal passed.');
}
