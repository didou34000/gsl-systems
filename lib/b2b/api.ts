import {z} from 'zod';
// The production route injects the dispatcher-authenticated identity; request bodies
// can never select a user, organisation owner or reviewer role.
type User={userId:string;email:string;displayName:string};
type Row=Record<string,string>;
type Context={db:D1Database;user:User|null;reviewerIds?:string[]};
class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
const deny=()=>{throw new HttpError(403,'Accès refusé')};
const missing=()=>{throw new HttpError(404,'Élément introuvable')};
const conflict=()=>{throw new HttpError(409,'La fiche a changé. Rechargez-la avant de continuer.')};
const txt=(min=1,max=500)=>z.string().trim().min(min).max(max);
const id=z.string().uuid();
const version={id,revision:id};
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('create_org'),kind:z.enum(['buyer','supplier']),name:txt(2,160),country:txt(2,100),description:txt(10,3000)}).strict(),
 z.object({action:z.literal('edit_org'),...version,name:txt(2,160),country:txt(2,100),description:txt(10,3000)}).strict(),
 z.object({action:z.literal('save_product'),id:id.optional(),revision:id.optional(),name:txt(3,160),category:txt(2,100),description:txt(20,4000),kind:z.enum(['product','capacity']).optional(),process:txt(0,300).optional(),materials:txt(0,500).optional(),equipment:txt(0,1000).optional(),dimensions:txt(0,500).optional(),volumes:txt(0,500).optional(),moq:z.number().int().min(0).max(100000000),priceCents:z.number().int().min(0).max(1000000000)}).strict(),
 z.object({action:z.literal('submit'),target:z.enum(['org','product']),...version}).strict(),
 z.object({action:z.literal('review'),target:z.enum(['org','product','document']),...version,decision:z.enum(['approved','rejected']),note:txt(5,2000)}).strict(),
 z.object({action:z.literal('publish'),target:z.enum(['org','product']),...version,published:z.boolean()}).strict(),
 z.object({action:z.literal('document'),productId:id.optional(),label:txt(3,160),reference:txt(2,160),issuer:txt(2,160),scope:txt(10,2000)}).strict(),
 z.object({action:z.literal('save_rfq'),mode:z.enum(['autonomous','assisted']).optional(),id:id.optional(),revision:id.optional(),productId:id.optional(),supplierId:id.optional(),title:txt(3,160),quantity:z.number().int().min(1).max(100000000),details:txt(20,8000)}).strict(),
 z.object({action:z.literal('delete_rfq'),...version}).strict(),
 z.object({action:z.literal('send_rfq'),...version,suppliers:z.array(id).min(1).max(10).refine(v=>new Set(v).size===v.length)}).strict(),
 z.object({action:z.literal('submit_assistance'),...version}).strict(),
 z.object({action:z.literal('review_assistance'),...version,decision:z.enum(['ready','needs_changes']),note:txt(5,2000)}).strict(),
 z.object({action:z.literal('archive_product'),...version}).strict(),
 z.object({action:z.literal('bookmark'),productId:id,selected:z.boolean()}).strict(),
 z.object({action:z.literal('report'),productId:id,reason:txt(10,2000)}).strict(),
 z.object({action:z.literal('resolve_report'),id,note:txt(5,2000)}).strict(),
 z.object({action:z.literal('declare_order'),offerId:id,reference:txt(3,160),note:txt(10,2000)}).strict(),
 z.object({action:z.literal('message'),threadId:id,body:txt(1,5000)}).strict(),
 z.object({action:z.literal('offer'),threadId:id,amountCents:z.number().int().min(1).max(1000000000),leadDays:z.number().int().min(1).max(3650),terms:txt(10,4000)}).strict(),
]);
const table={org:'organisations',product:'business_products',document:'document_registers'} as const;
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function handleBusiness(request:Request,{db,user,reviewerIds=[]}:Context):Promise<Response>{
 try{
  if(!user)return json({error:'Connexion nécessaire'},401);
  const one=async(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args).first<Row>();
  const all=async(sql:string,...args:unknown[])=> (await db.prepare(sql).bind(...args).all<Row>()).results;
  const stmt=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args);
  const member=await one('SELECT * FROM memberships WHERE user_id=?',user.userId);
  const org=member?await one('SELECT * FROM organisations WHERE id=?',member.org_id):null;
  const isReviewer=reviewerIds.includes(user.userId)||!!await one('SELECT user_id FROM reviewers WHERE user_id=?',user.userId);
  const reviewConfigured=reviewerIds.length>0||!!await one('SELECT user_id FROM reviewers LIMIT 1');
  const requireOrg=(kind?:string)=>{if(!org||!member||!['owner','member'].includes(member.role)||(kind&&org.kind!==kind))deny();return org!};
  const own=async(target:keyof typeof table,key:string)=>{const o=requireOrg('supplier');const row=await one(`SELECT * FROM ${table[target]} WHERE id=?`,key);if(!row)missing();if((target==='org'?row!.id:row!.org_id)!==o.id)deny();return row!};
  const conversation=async(key:string)=>{const o=requireOrg();const t=await one('SELECT t.*, r.buyer_org_id, r.title, r.quantity, r.details,r.mode,r.assistance_status,r.product_name,r.supplier_name,r.supplier_org_id AS selected_supplier FROM business_threads t JOIN rfqs r ON r.id=t.rfq_id WHERE t.id=?',key);if(!t)missing();if(t!.buyer_org_id!==o.id&&t!.supplier_org_id!==o.id)deny();return t!};
  if(request.method==='GET'){
   const q=new URL(request.url).searchParams,view=q.get('view')||'dashboard';
   if(view==='catalogue'){const query=(q.get('q')||'').slice(0,200);return json({products:await all("SELECT p.id,p.name,p.kind,p.process,p.materials,p.equipment,p.dimensions,p.volumes,p.category,p.description,p.moq,p.price_cents,o.name AS company,o.country,o.id AS org_id FROM business_products p JOIN organisations o ON o.id=p.org_id WHERE p.status='approved' AND p.published='yes' AND o.status='approved' AND o.published='yes' AND (instr(lower(p.name||' '||p.category||' '||p.description||' '||p.process||' '||p.materials||' '||o.name),lower(?))>0) ORDER BY p.created_at DESC LIMIT 100",query),bookmarks:await all('SELECT product_id FROM business_bookmarks WHERE user_id=?',user.userId),suppliers:await all("SELECT id,name,country,description FROM organisations WHERE kind='supplier' AND status='approved' AND published='yes' ORDER BY name LIMIT 100")});}
   if(view==='thread'){const t=await conversation(q.get('id')||'');return json({thread:t,messages:await all('SELECT m.*,o.name AS sender FROM business_messages m JOIN organisations o ON o.id=m.sender_org_id WHERE m.thread_id=? ORDER BY m.created_at,m.id',t.id),offers:await all('SELECT * FROM business_offers WHERE thread_id=? ORDER BY created_at,id',t.id),orders:await all('SELECT * FROM declared_orders WHERE thread_id=? ORDER BY created_at',t.id)});}
   if(view==='product'){const p=await one('SELECT * FROM business_products WHERE id=?',q.get('id'));if(!p)missing();if(!org||p!.org_id!==org.id)deny();return json(p);}
   if(view==='org'){const requested=q.get('id');if(!org||requested!==org.id)deny();return json(org);}
   if(view==='rfq'){const r=await one('SELECT * FROM rfqs WHERE id=?',q.get('id'));if(!r)missing();if((!org||r!.buyer_org_id!==org.id)&&!(isReviewer&&r!.mode==='assisted'&&['submitted','ready','needs_changes'].includes(r!.assistance_status)))deny();return json(r);}
   if(view==='sourcing'){if(!isReviewer)deny();return json(await all("SELECT r.*,o.name AS buyer FROM rfqs r JOIN organisations o ON o.id=r.buyer_org_id WHERE r.mode='assisted' AND r.assistance_status IN ('submitted','ready','needs_changes') AND r.status!='deleted' ORDER BY r.created_at DESC"));}
   if(view==='deals'){if(!isReviewer)deny();return json(await all('SELECT d.*,r.title,r.id AS rfq_id,r.mode,b.name AS buyer,s.name AS supplier FROM declared_orders d JOIN business_threads t ON t.id=d.thread_id JOIN rfqs r ON r.id=t.rfq_id JOIN organisations b ON b.id=r.buyer_org_id JOIN organisations s ON s.id=t.supplier_org_id ORDER BY d.created_at DESC'));}
   if(view==='reports'){if(!isReviewer)deny();return json(await all('SELECT r.*,p.name FROM business_reports r JOIN business_products p ON p.id=r.product_id ORDER BY r.created_at DESC'));}
   if(view==='reviews'){if(!isReviewer)deny();return json({organisations:await all("SELECT * FROM organisations WHERE kind='supplier' AND status='submitted'"),products:await all("SELECT p.*,o.name AS company FROM business_products p JOIN organisations o ON o.id=p.org_id WHERE p.status='submitted'"),documents:await all("SELECT d.*,o.name AS company FROM document_registers d JOIN organisations o ON o.id=d.org_id WHERE d.status='unreviewed'"),history:await all('SELECT * FROM review_events ORDER BY created_at DESC LIMIT 100')});}
   if(view!=='dashboard')throw new HttpError(400,'Vue inconnue');
   return json({user:{name:user.displayName,id:user.userId},isReviewer,reviewConfigured,org,role:member?.role,products:org?.kind==='supplier'?await all('SELECT * FROM business_products WHERE org_id=? ORDER BY created_at DESC',org.id):[],documents:org?.kind==='supplier'?await all('SELECT * FROM document_registers WHERE org_id=?',org.id):[],rfqs:org?.kind==='buyer'?await all("SELECT * FROM rfqs WHERE buyer_org_id=? AND status!='deleted' ORDER BY created_at DESC",org.id):[],proposals:org?.kind==='buyer'?await all('SELECT f.*,t.rfq_id,r.title,s.name AS supplier FROM business_offers f JOIN business_threads t ON t.id=f.thread_id JOIN rfqs r ON r.id=t.rfq_id JOIN organisations s ON s.id=f.supplier_org_id WHERE r.buyer_org_id=? ORDER BY r.id,f.created_at',org.id):[],threads:org?await all('SELECT t.*,r.title,r.buyer_org_id,b.name AS buyer,s.name AS supplier FROM business_threads t JOIN rfqs r ON r.id=t.rfq_id JOIN organisations b ON b.id=r.buyer_org_id JOIN organisations s ON s.id=t.supplier_org_id WHERE r.buyer_org_id=? OR t.supplier_org_id=? ORDER BY t.created_at DESC',org.id,org.id):[]});
  }
  if(request.method!=='POST')return json({error:'Méthode non autorisée'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origine non autorisée'},403);
  const raw=await request.text();if(raw.length>24000)return json({error:'Dossier trop volumineux'},413);
  let input;try{input=JSON.parse(raw)}catch{return json({error:'JSON invalide'},400)}
  const parsed=actions.safeParse(input);if(!parsed.success)return json({error:'Vérifiez les champs et rechargez la fiche si nécessaire.'},400);
  const a=parsed.data,now=new Date().toISOString(),newId=crypto.randomUUID(),rev=crypto.randomUUID();
  const changed=async(s:D1PreparedStatement)=>{const r=await s.run();if(r.meta.changes!==1)conflict()};
  if(a.action==='create_org'){
   if(member)throw new HttpError(409,'Votre compte appartient déjà à une organisation.');
   // D1 batch is atomic: concurrent onboarding cannot create orphan organisations.
   await db.batch([stmt('INSERT INTO organisations (id,kind,name,country,description,status,published,revision,review_note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',newId,a.kind,a.name,a.country,a.description,'draft','no',rev,'',now),stmt("INSERT INTO memberships (user_id,org_id,role) VALUES (?,?,'owner')",user.userId,newId)]);return json({id:newId});
  }
  if(a.action==='edit_org'){const o=requireOrg();if(a.id!==o.id)deny();await changed(stmt("UPDATE organisations SET name=?,country=?,description=?,status='draft',published='no',review_note='',revision=? WHERE id=? AND revision=?",a.name,a.country,a.description,rev,o.id,a.revision));return json({ok:true});}
  if(a.action==='save_product'){
   const o=requireOrg('supplier');if(a.id){await own('product',a.id);await changed(stmt("UPDATE business_products SET name=?,category=?,description=?,moq=?,price_cents=?,kind=?,process=?,materials=?,equipment=?,dimensions=?,volumes=?,status='draft',published='no',review_note='',revision=? WHERE id=? AND org_id=? AND revision=?",a.name,a.category,a.description,String(a.moq),String(a.priceCents),a.kind||'product',a.process||'',a.materials||'',a.equipment||'',a.dimensions||'',a.volumes||'',rev,a.id,o.id,a.revision||''));}
   else await stmt("INSERT INTO business_products (id,org_id,name,category,description,moq,price_cents,kind,process,materials,equipment,dimensions,volumes,status,published,revision,review_note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'draft','no',?,'',?)",newId,o.id,a.name,a.category,a.description,String(a.moq),String(a.priceCents),a.kind||'product',a.process||'',a.materials||'',a.equipment||'',a.dimensions||'',a.volumes||'',rev,now).run();return json({id:a.id||newId});
  }
  if(a.action==='submit'){const row=await own(a.target,a.id);if(!['draft','rejected'].includes(row.status))throw new HttpError(409,'Cette fiche ne peut pas être soumise dans cet état.');await changed(stmt(`UPDATE ${table[a.target]} SET status='submitted',published='no',revision=?,review_note='' WHERE id=? AND revision=? AND status IN ('draft','rejected')`,rev,a.id,a.revision));return json({ok:true});}
  if(a.action==='review'){
   if(!isReviewer)deny();const row=await one(`SELECT * FROM ${table[a.target]} WHERE id=?`,a.id);if(!row)missing();if(row!.revision!==a.revision||row!.status!==(a.target==='document'?'unreviewed':'submitted'))conflict();
   // A single batch records both the decision and its matching audit event.
   const status=a.target==='document'?(a.decision==='approved'?'reviewed':'needs_changes'):a.decision;
   await db.batch([stmt(`INSERT INTO review_events (id,target_id,actor_id,decision,note,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ${table[a.target]} WHERE id=? AND revision=? AND status=?)`,newId,a.id,user.userId,status,a.note,now,a.id,a.revision,row!.status),stmt(`UPDATE ${table[a.target]} SET status=?,review_note=?,revision=? WHERE id=? AND revision=? AND status=?`,status,a.note,rev,a.id,a.revision,row!.status)]).then(r=>{if(r[1].meta.changes!==1)conflict()});return json({ok:true});
  }
  if(a.action==='publish'){await own(a.target,a.id);await changed(stmt(`UPDATE ${table[a.target]} SET published=?,revision=? WHERE id=? AND revision=? AND status='approved'`,a.published?'yes':'no',rev,a.id,a.revision));return json({ok:true});}
  if(a.action==='document'){const o=requireOrg('supplier');if(a.productId)await own('product',a.productId);await stmt("INSERT INTO document_registers (id,org_id,product_id,label,reference,issuer,scope,status,review_note,revision,created_at) VALUES (?,?,?,?,?,?,?,'unreviewed','',?,?)",newId,o.id,a.productId||null,a.label,a.reference,a.issuer,a.scope,rev,now).run();return json({id:newId});}
  if(a.action==='save_rfq'){
   const o=requireOrg('buyer');
   if(a.id){const r=await one('SELECT * FROM rfqs WHERE id=?',a.id);if(!r)missing();if(r!.buyer_org_id!==o.id)deny();if(r!.assistance_status==='submitted')throw new HttpError(409,'Le dossier transmis est en cours d’examen.');if(a.mode&&a.mode!==r!.mode)throw new HttpError(400,'Le parcours de cette demande est conservé.');
    if((a.productId&&a.productId!==r!.product_id)||(a.supplierId&&a.supplierId!==r!.supplier_org_id))throw new HttpError(400,'Le destinataire d’origine est conservé. Créez une autre demande pour changer de référence.');
    await changed(stmt("UPDATE rfqs SET title=?,quantity=?,details=?,revision=?,assistance_status='draft',assistance_note='' WHERE id=? AND buyer_org_id=? AND revision=? AND status='draft'",a.title,String(a.quantity),a.details,rev,a.id,o.id,a.revision||''));
   }else{
    let product:Row|null=null,supplier:Row|null=null;
    if(a.productId){product=await one("SELECT p.* FROM business_products p JOIN organisations o ON o.id=p.org_id WHERE p.id=? AND p.status='approved' AND p.published='yes' AND o.status='approved' AND o.published='yes'",a.productId);if(!product)throw new HttpError(400,'Cette référence n’est plus disponible. Revenez au catalogue.');}
    const supplierId=product?.org_id||a.supplierId;
    if(supplierId){supplier=await one("SELECT * FROM organisations WHERE id=? AND kind='supplier' AND status='approved' AND published='yes'",supplierId);if(!supplier)throw new HttpError(400,'Ce fournisseur n’est plus disponible. Revenez au catalogue.');}
    if(product&&a.supplierId&&a.supplierId!==product.org_id)throw new HttpError(400,'Produit et fournisseur incohérents.');
    await stmt("INSERT INTO rfqs (id,buyer_org_id,title,quantity,details,status,revision,created_at,product_id,supplier_org_id,product_name,supplier_name,mode) VALUES (?,?,?,?,?,'draft',?,?,?,?,?,?,?)",newId,o.id,a.title,String(a.quantity),a.details,rev,now,product?.id||null,supplier?.id||null,product?.name||null,supplier?.name||null,a.mode||'autonomous').run();
   }return json({id:a.id||newId});
  }
  if(a.action==='delete_rfq'||a.action==='send_rfq'){
   const o=requireOrg('buyer'),r=await one('SELECT * FROM rfqs WHERE id=?',a.id);if(!r)missing();if(r!.buyer_org_id!==o.id)deny();if(r!.status!=='draft'||r!.revision!==a.revision)conflict();
   if(a.action==='delete_rfq'){await changed(stmt("UPDATE rfqs SET status='deleted',revision=? WHERE id=? AND buyer_org_id=? AND revision=? AND status='draft'",rev,a.id,o.id,a.revision));return json({ok:true});}
   if(r!.mode==='assisted'&&r!.assistance_status!=='ready')throw new HttpError(409,'Le dossier accompagné doit être examiné avant la consultation.');
   if(r!.supplier_org_id&&!a.suppliers.includes(r!.supplier_org_id))throw new HttpError(400,'Conservez le fournisseur sélectionné pour cette demande.');
   for(const supplier of a.suppliers){if(!await one("SELECT id FROM organisations WHERE id=? AND kind='supplier' AND status='approved' AND published='yes'",supplier))throw new HttpError(400,'Un fournisseur sélectionné n’est plus disponible.');}
   // Compare-and-swap first; inserts require this operation's unique revision.
   const results=await db.batch([stmt("UPDATE rfqs SET status='sent',revision=? WHERE id=? AND buyer_org_id=? AND revision=? AND status='draft'",rev,a.id,o.id,a.revision),...a.suppliers.map(s=>stmt("INSERT INTO business_threads (id,rfq_id,supplier_org_id,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM rfqs WHERE id=? AND revision=? AND status='sent')",crypto.randomUUID(),a.id,s,now,a.id,rev))]);if(results[0].meta.changes!==1)conflict();return json({ok:true});
  }
  if(a.action==='submit_assistance'){
   const o=requireOrg('buyer');const r=await one('SELECT * FROM rfqs WHERE id=?',a.id);if(!r)missing();if(r!.buyer_org_id!==o.id)deny();if(!reviewConfigured)throw new HttpError(409,'L’examen GSL systems n’est pas encore ouvert. Votre brouillon reste privé.');
   await changed(stmt("UPDATE rfqs SET assistance_status='submitted',assistance_note='',revision=? WHERE id=? AND buyer_org_id=? AND revision=? AND mode='assisted' AND status='draft' AND assistance_status IN ('draft','needs_changes')",rev,a.id,o.id,a.revision));return json({ok:true});
  }
  if(a.action==='review_assistance'){
   if(!isReviewer)deny();await changed(stmt("UPDATE rfqs SET assistance_status=?,assistance_note=?,revision=? WHERE id=? AND revision=? AND mode='assisted' AND status='draft' AND assistance_status='submitted'",a.decision,a.note,rev,a.id,a.revision));return json({ok:true});
  }
  if(a.action==='archive_product'){await own('product',a.id);await changed(stmt("UPDATE business_products SET status='archived',published='no',revision=? WHERE id=? AND revision=?",rev,a.id,a.revision));return json({ok:true});}
  if(a.action==='bookmark'||a.action==='report'){
   const p=await one("SELECT p.id FROM business_products p JOIN organisations o ON o.id=p.org_id WHERE p.id=? AND p.status='approved' AND p.published='yes' AND o.status='approved' AND o.published='yes'",a.productId);if(!p)missing();
   if(a.action==='bookmark'){if(a.selected)await stmt('INSERT OR IGNORE INTO business_bookmarks (user_id,product_id) VALUES (?,?)',user.userId,a.productId).run();else await stmt('DELETE FROM business_bookmarks WHERE user_id=? AND product_id=?',user.userId,a.productId).run();}
   else await stmt("INSERT INTO business_reports (id,user_id,product_id,reason,status,note,created_at) VALUES (?,?,?,?,'open','',?)",newId,user.userId,a.productId,a.reason,now).run();return json({ok:true});
  }
  if(a.action==='resolve_report'){if(!isReviewer)deny();await changed(stmt("UPDATE business_reports SET status='resolved',note=? WHERE id=? AND status='open'",a.note,a.id));return json({ok:true});}
  if(a.action==='declare_order'){
   const o=requireOrg('buyer'),f=await one('SELECT * FROM business_offers WHERE id=?',a.offerId);if(!f)missing();const t=await conversation(f!.thread_id);if(t.buyer_org_id!==o.id)deny();
   if(await one('SELECT id FROM declared_orders WHERE offer_id=?',a.offerId))throw new HttpError(409,'Une commande a déjà été déclarée pour cette proposition.');
   await stmt('INSERT INTO declared_orders (id,offer_id,thread_id,buyer_org_id,reference,note,created_at) VALUES (?,?,?,?,?,?,?)',newId,a.offerId,t.id,o.id,a.reference,a.note,now).run();return json({id:newId});
  }
  if(a.action==='message'||a.action==='offer'){
   const o=requireOrg(),t=await conversation(a.threadId);
   if(a.action==='message')await stmt('INSERT INTO business_messages (id,thread_id,sender_org_id,body,created_at) VALUES (?,?,?,?,?)',newId,t.id,o.id,a.body,now).run();
   else {if(t.supplier_org_id!==o.id||o.kind!=='supplier')deny();await stmt('INSERT INTO business_offers (id,thread_id,supplier_org_id,amount_cents,lead_days,terms,created_at) VALUES (?,?,?,?,?,?,?)',newId,t.id,o.id,String(a.amountCents),String(a.leadDays),a.terms,now).run();}return json({id:newId});
  }
  return json({error:'Action inconnue'},400);
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error('business_request_failed',e);return json({error:'Opération indisponible. Votre saisie est conservée. Réessayez après rechargement.'},503)}
}
