import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testProductPublication(db){
 await db.exec('reset role');
 const ids={supplier:randomUUID(),other:randomUUID(),admin:randomUUID(),analyst:randomUUID()};
 for(const id of Object.values(ids))await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 await db.query("insert into private.platform_admins(user_id,role) values($1,'admin'),($2,'analyst')",[ids.admin,ids.analyst]);
 const as=async(id,aal='aal2',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",[id||'',aal]);await db.exec('set role '+role)};
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const review=(action,args={})=>scalar('select public.supplier_product_review($1,$2)',[action,JSON.stringify(args)]);
 const image=(action,args)=>scalar('select public.product_image($1,$2)',[action,JSON.stringify(args)]);
 const profile={legalName:'Synthetic reviewed product maker',country:'TR',activity:'manufacturer',description:'Synthetic company for reviewed product publication.',headquarters:{city:'Bursa'},contact:{name:'Contact',email:'private@example.invalid'},attestation:true,products:[]};
 await as(ids.supplier);let application=await scalar('select public.publish_supplier_basics($1,0)',[JSON.stringify(profile)]);const organization=application.organization_id;
 const source=randomUUID();profile.products=[{id:source,listingStatus:'publish',name:'CNC component',category:'metal',family:'usinage-precision',specs:{kind:'machined',tolerance_mm:'0.02'},description:'A mechanical component made for industrial robotic assemblies.',origin:'TR',moq:'100',unit:'pcs',reference:'REF-1',photoIds:[]}];
 // Save the source id before reserving its first image.
 await db.query('update public.supplier_applications set payload=$1 where owner_id=auth.uid()',[JSON.stringify(profile)]);
 application=await scalar('select jsonb_build_object(\'revision\',revision) from public.supplier_applications where owner_id=auth.uid()');
 const photo=await image('reserve',{product:source,size:16});
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('gsl-product-images',$1,'{\"size\":16}')",[photo.path]);
 await image('finalize',{id:photo.id});profile.products[0].photoIds=[photo.id];
 assert.equal((await image('read',{id:photo.id})).path,photo.path);
 await as(ids.other);await assert.rejects(image('read',{id:photo.id}),/NOT_FOUND/);
 await as(null,'aal1','anon');await assert.rejects(image('read',{id:photo.id}),/NOT_FOUND/);
 const send=async(payload=profile,revision=application.revision)=>scalar('select public.submit_supplier_products($1,$2)',[JSON.stringify(payload),revision]);
 await as(ids.supplier);
 await assert.rejects(send({...profile,products:[{...profile.products[0],moq:'0'}]}),/INCOMPLETE/);
 await assert.rejects(send({...profile,products:[{...profile.products[0],photoIds:[randomUUID()]}]}),/IMAGE_NOT_READY/);
 application=await send();let own=await review('own');assert.equal(own.length,1);assert.equal(own[0].status,'pending');assert.equal(own[0].sourceId,source);
 assert.equal((await db.query('select * from public.published_products where organization_id=$1',[organization])).rows.length,0,'submission creates no public product, even for the supplier');
 await as(null,'aal1','anon');assert.equal((await db.query('select * from public.published_products where organization_id=$1',[organization])).rows.length,0);await assert.rejects(image('read',{id:photo.id}),/NOT_FOUND/);
 const request=own[0];const args={id:request.id,revision:request.revision,feedback:'Product and image reviewed.',family:'pieces-mecaniques',site:'Bursa production site',roboticsOffer:'Mechanical component for industrial robotic assemblies.',sources:[{url:'https://manufacturer.example.invalid/component',title:'Manufacturer product datasheet'}]};
 await as(ids.supplier);await assert.rejects(review('approve',args),/ADMIN_REQUIRED/);await assert.rejects(review('queue'),/ADMIN_REQUIRED/);
 await as(ids.analyst);await assert.rejects(review('approve',args),/PERMISSION_REQUIRED/);
 await as(ids.admin,'aal1');await assert.rejects(review('approve',args),/MFA_REQUIRED/);
 await as(ids.admin);assert.equal((await review('queue')).length,1);assert.equal((await image('read',{id:photo.id})).path,photo.path);
 const approved=await review('approve',args);assert.ok(approved.productId);const product=approved.productId;
 await assert.rejects(review('approve',args),/CONFLICT/);
 await as(null,'aal1','anon');let publicRow=await scalar('select to_jsonb(p) from public.published_products p where product_id=$1',[product]);assert.equal(publicRow.name,'CNC component');assert.ok(publicRow.specifications.photo_ids.includes(photo.id));
 assert.equal((await db.query('select * from public.component_products where product_id=$1',[product])).rows.length,1,'admin approval admits the product to the real catalogue');
 assert.equal((await image('read',{id:photo.id})).path,photo.path,'only approved selected images become public');
 // A change is staged without overwriting the approved public version or its image.
 await as(ids.supplier);profile.products[0].name='Updated component';profile.products[0].reference='REF-2';application=await send();own=await review('own');assert.equal(own[0].status,'pending');
 await as(null,'aal1','anon');assert.equal(await scalar('select name from public.published_products where product_id=$1',[product]),'CNC component');
 await as(ids.admin);await review('changes_requested',{id:own[0].id,revision:own[0].revision,feedback:'Please add a more precise technical description.'});
 await as(ids.supplier);own=await review('own');assert.equal(own[0].status,'changes_requested');assert.match(own[0].feedback,/technical/);
 application=await send();own=await review('own');await as(ids.admin);await review('approve',{...args,id:own[0].id,revision:own[0].revision});
 await as(null,'aal1','anon');assert.equal(await scalar('select name from public.published_products where product_id=$1',[product]),'Updated component');assert.equal((await db.query('select * from public.component_products where product_id=$1',[product])).rows.length,1,'public id survives renamed product and reference');
 // Draft withdrawal removes the product and photos from every public access path.
 await as(ids.supplier);profile.products[0].listingStatus='draft';application=await send();
 await as(null,'aal1','anon');assert.equal((await db.query('select * from public.published_products where product_id=$1',[product])).rows.length,0);assert.equal((await db.query('select * from public.component_products where product_id=$1',[product])).rows.length,0);await assert.rejects(image('read',{id:photo.id}),/NOT_FOUND/);
 // The old RPC name is also submission-only, not a bypass from a legacy client.
 await as(ids.supplier);profile.products[0].listingStatus='publish';application=await scalar('select public.publish_supplier_products($1,$2)',[JSON.stringify(profile),application.revision]);
 await as(null,'aal1','anon');assert.equal((await db.query('select * from public.published_products where product_id=$1',[product])).rows.length,0);
 await as(ids.other);assert.deepEqual(await review('own'),[]);await assert.rejects(db.query('select * from private.supplier_product_reviews'),/permission denied/);
 await db.exec('reset role');assert.equal(await scalar('select count(*)::int from private.supplier_product_review_events where request_id=$1',[request.id]),3);
 await assert.rejects(db.query('delete from private.supplier_product_review_events where request_id=$1',[request.id]),/AUDIT_IMMUTABLE/);
 console.log('Reviewed products: private submission and photos, owner isolation, admin/role/AAL2 gates, rejection feedback, exact revision approval, catalogue admission, stable URLs, approved version retained during edits, withdrawal and old-RPC bypass prevention passed.');
}
