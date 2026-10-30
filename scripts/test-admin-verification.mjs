import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testAdminVerification(db){
 await db.exec('reset role');
 const ids={supplier:randomUUID(),admin:randomUUID(),analyst:randomUUID()};
 for(const id of Object.values(ids))await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 await db.query("insert into private.platform_admins(user_id,role) values($1,'admin'),($2,'analyst')",[ids.admin,ids.analyst]);
 const as=async(id,aal='aal2',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id||'',aal]);await db.exec('set role '+role)};
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const verify=(action,args)=>scalar('select public.admin_verification($1,$2)',[action,JSON.stringify(args)]);
 const companyStatus=org=>scalar("select public_details->>'verification' from public.published_supplier_profiles where organization_id=$1",[org]);
 const productStatus=id=>scalar("select specifications->>'verification' from public.published_products where product_id=$1",[id]);
 const inCatalogue=async id=>(await db.query('select 1 from public.component_products where product_id=$1',[id])).rows.length===1;
 const profile={legalName:'Synthetic verified maker',country:'TN',activity:'manufacturer',description:'Synthetic company for administrator verification.',headquarters:{city:'Sfax'},contact:{name:'Contact',email:'private@example.invalid'},attestation:true,products:[]};
 await as(ids.supplier);let application=await scalar('select public.publish_supplier_basics($1,0)',[JSON.stringify(profile)]);const org=application.organization_id;
 await as(null,'aal1','anon');assert.equal(await companyStatus(org),'unverified');
 // Only active owner/admin accounts with AAL2 can verify.
 await as(ids.supplier);await assert.rejects(verify('company.verify',{id:org}),/ADMIN_REQUIRED/);
 await as(ids.analyst);await assert.rejects(verify('company.verify',{id:org}),/PERMISSION_REQUIRED/);
 await as(ids.admin,'aal1');await assert.rejects(verify('company.verify',{id:org}),/MFA_REQUIRED/);
 await as(ids.admin);await assert.rejects(verify('company.verify',{id:randomUUID()}),/NOT_FOUND/);await assert.rejects(verify('company.delete',{id:org}),/INVALID/);
 await verify('company.verify',{id:org});
 await as(null,'aal1','anon');assert.equal(await companyStatus(org),'verified');
 // Acceptance puts the company online among manufacturers, even before it has an offer.
 assert.equal((await db.query('select 1 from public.component_supplier_profiles where organization_id=$1',[org])).rows.length,1);
 const listed=await scalar('select public.search_components_catalogue($1)',[JSON.stringify({})]);
 assert.deepEqual(listed.suppliers.find(s=>s.organization_id===org)?.matched_products,[],'verified company listed without offers');
 assert.equal((await scalar('select public.search_components_catalogue($1)',[JSON.stringify({category:'prehension'})])).suppliers.some(s=>s.organization_id===org),false,'product filters exclude it');
 // A supplier republication keeps the administrator's decision.
 await as(ids.supplier);profile.description='Synthetic company for administrator verification, updated.';application=await scalar('select public.publish_supplier_basics($1,$2)',[JSON.stringify(profile),application.revision]);
 await as(null,'aal1','anon');assert.equal(await companyStatus(org),'verified','republication keeps verification');
 // A product approved from the queue is verified; removing verification takes it out of the catalogue.
 const source=randomUUID();profile.products=[{id:source,listingStatus:'publish',name:'Servo actuator',category:'metal',family:'actionnement-transmission',specs:{},description:'A servo actuator made for industrial robotic joints.',origin:'TN',moq:'10',unit:'pcs',reference:'SRV-1',photoIds:[]}];
 await as(ids.supplier);application=await scalar('select public.submit_supplier_products($1,$2)',[JSON.stringify(profile),application.revision]);
 const own=await scalar("select public.supplier_product_review('own','{}')");
 const sources=[{url:'https://maker.example.invalid/servo',title:'Datasheet'}];
 await as(ids.admin);const approved=await scalar('select public.supplier_product_review($1,$2)',['approve',JSON.stringify({id:own[0].id,revision:own[0].revision,feedback:'Checked.',family:'actionnement-transmission',site:'Sfax plant',roboticsOffer:'Servo actuator for robotic joints and arms.',sources})]);
 const product=approved.productId;
 await as(null,'aal1','anon');assert.equal(await productStatus(product),'verified','queue approval verifies the product');assert.ok(await inCatalogue(product));
 await as(ids.admin);await verify('product.unverify',{id:product});
 await as(null,'aal1','anon');assert.equal(await productStatus(product),'unverified');assert.equal(await inCatalogue(product),false);
 // One-click acceptance puts the product online as published; removing it takes it out again.
 await as(ids.admin);await verify('product.verify',{id:product});
 await as(null,'aal1','anon');assert.equal(await productStatus(product),'verified');assert.ok(await inCatalogue(product),'one-click acceptance publishes the product');
 assert.equal((await db.query('select count(*)::int n from public.component_products where product_id=$1',[product])).rows[0].n,1);
 await as(ids.admin);await verify('product.unverify',{id:product});
 await as(null,'aal1','anon');assert.equal(await inCatalogue(product),false);
 // Direct verification from the admin table admits an already published product.
 await as(ids.admin);await assert.rejects(verify('product.verify',{id:product,family:'actionnement-transmission',site:'Sfax plant',roboticsOffer:'too short',sources}),/INVALID/);
 await assert.rejects(verify('product.verify',{id:product,family:'actionnement-transmission',site:'Sfax plant',roboticsOffer:'Servo actuator for robotic joints and arms.',sources:[]}),/INVALID/);
 await verify('product.verify',{id:product,family:'actionnement-transmission',site:'Sfax plant',roboticsOffer:'Servo actuator for robotic joints and arms.',sources});
 await as(null,'aal1','anon');assert.equal(await productStatus(product),'verified');assert.ok(await inCatalogue(product));
 await as(ids.admin);await verify('company.unverify',{id:org});
 await as(null,'aal1','anon');assert.equal(await companyStatus(org),'unverified');
 await as(ids.supplier);await assert.rejects(db.query('select * from private.admin_verifications'),/permission denied/);
 await db.exec('reset role');assert.equal(await scalar("select count(*)::int from private.admin_events where resource_id=$1 and action like 'company_%'",[org]),2);
 console.log('Admin verification: owner/admin + AAL2 gate, company verify/unverify kept across republication, queue approval verifies, product unverify removes from catalogue, one-click company/product acceptance online, direct product verification admits to catalogue, audit events passed.');
}
