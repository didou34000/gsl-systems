import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testCompanyBranding(db){
 const owner=randomUUID(),other=randomUUID();await db.exec('reset role');for(const id of [owner,other])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 const as=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)};
 const p={legalName:'Branding test',country:'TR',activity:'manufacturer',description:'An industrial company for private branding test fixtures.',headquarters:{city:'Bursa'},contact:{name:'Reference person',role:'Sales',email:'reference@example.invalid',phone:'+90 212 555 0100',publish:false},attestation:true};
 const publish=async(revision,payload=p)=>(await db.query('select public.publish_supplier_basics($1,$2) value',[JSON.stringify(payload),revision])).rows[0].value;
 const image=async(action,args)=>(await db.query('select public.company_image($1,$2) value',[action,JSON.stringify(args)])).rows[0].value;
 await as(owner);let a=await publish(0);const org=a.organization_id;
 const add=async kind=>{const i=await image('reserve',{kind,size:16});await db.query("insert into storage.objects(bucket_id,name,metadata) values('gsl-company-images',$1,'{\"size\":16}')",[i.path]);return i};
 const logo=await add('logo'),covers=[];for(let n=0;n<6;n++)covers.push(await add('cover'));
 await as(other);await assert.rejects(image('read',{id:logo.id}),/NOT_FOUND/);assert.equal((await db.query("select * from storage.objects where bucket_id='gsl-company-images' and name=$1",[logo.path])).rows.length,0);
 await as(null,'anon');await assert.rejects(image('read',{id:logo.id}),/NOT_FOUND/);await assert.rejects(image('reserve',{kind:'logo',size:16}),/LOGIN_REQUIRED/);
 await as(owner);p.branding={logoId:logo.id,coverIds:covers.slice(0,5).map(i=>i.id)};a=await publish(a.revision);
 await as(null,'anon');assert.equal((await image('read',{id:logo.id})).path,logo.path);assert.equal((await db.query("select * from storage.objects where bucket_id='gsl-company-images' and name=$1",[logo.path])).rows.length,1);await assert.rejects(image('read',{id:covers[5].id}),/NOT_FOUND/);
 let pub=(await db.query('select public_details from public.published_supplier_profiles where organization_id=$1',[org])).rows[0].public_details;assert.equal(pub.branding.coverIds.length,5);assert.ok(!pub.referenceContact,'contact stays private by default');
 await as(owner);await assert.rejects(publish(a.revision,{...p,branding:{...p.branding,coverIds:covers.map(i=>i.id)}}),/IMAGE_LIMIT/);
 await assert.rejects(publish(a.revision,{...p,branding:{logoId:covers[0].id,coverIds:[]}}),/IMAGE_NOT_READY/);
 await as(other);await publish(0,{...p,branding:{logoId:'',coverIds:[]}});await assert.rejects(publish(1,p),/IMAGE_NOT_READY/);
 await as(owner);p.contact.publish=true;p.branding={logoId:'',coverIds:[covers[4].id]};a=await publish(a.revision);
 await as(null,'anon');await assert.rejects(image('read',{id:logo.id}),/NOT_FOUND/);pub=(await db.query('select public_details from public.published_supplier_profiles where organization_id=$1',[org])).rows[0].public_details;assert.ok(!pub.referenceContact,'legacy contact opt-in no longer exposes contact details');assert.equal(pub.branding.coverIds[0],covers[4].id);
 await as(owner);p.contact.publish=false;a=await publish(a.revision);assert.ok(!(await db.query('select public_details from public.published_supplier_profiles where organization_id=$1',[org])).rows[0].public_details.referenceContact);await assert.rejects(db.query('select private.publish_supplier_basics_core($1,$2)',[JSON.stringify(p),a.revision]),/permission denied/);
 await db.exec('reset role');console.log('Company branding: private staged images, owner isolation, public selected logo + five photos, limit/type enforcement, replacement, cover order, contact privacy even for legacy opt-ins passed.');
}
