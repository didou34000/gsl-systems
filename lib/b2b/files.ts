type Row=Record<string,string>;
type Context={db:D1Database;bucket?:R2Bucket;user:{userId:string}|null;reviewerIds?:string[]};
export async function handleFiles(request:Request,{db,bucket,user,reviewerIds=[]}:Context){
 const out=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
 try{
 if(!user)return out({error:'Connexion nécessaire'},401);
 const one=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args).first<Row>();
 const member=await one('SELECT * FROM memberships WHERE user_id=?',user.userId);
 const reviewer=reviewerIds.includes(user.userId)||!!await one('SELECT user_id FROM reviewers WHERE user_id=?',user.userId);
 const q=new URL(request.url).searchParams;
 const file=q.get('id')?await one('SELECT * FROM business_files WHERE id=?',q.get('id')):null;
 if(q.get('id')&&!file)return out({error:'Document introuvable'},404);
 const rfqId=file?.rfq_id||q.get('rfq'),productId=file?.product_id||q.get('product');
 if((!rfqId&&!productId)||(rfqId&&productId))return out({error:'Dossier nécessaire'},400);
 const record=await one(`SELECT * FROM ${rfqId?'rfqs':'business_products'} WHERE id=?`,rfqId||productId);
 if(!record)return out({error:'Dossier introuvable'},404);
 const owner=!!member&&member.org_id===(rfqId?record.buyer_org_id:record.org_id);
 let allowed=owner;
 if(rfqId){
  if(reviewer&&record.mode==='assisted'&&['submitted','ready','needs_changes'].includes(record.assistance_status)&&record.status!=='deleted')allowed=true;
  if(member&&await one('SELECT id FROM business_threads WHERE rfq_id=? AND supplier_org_id=?',rfqId,member.org_id))allowed=true;
 }else{
  const supplier=await one('SELECT status,published FROM organisations WHERE id=?',record.org_id);
  if(record.status==='approved'&&record.published==='yes'&&supplier?.status==='approved'&&supplier.published==='yes')allowed=true;
  if(reviewer&&record.status==='submitted')allowed=true;
 }
 if(!allowed)return out({error:'Accès refusé'},403);
 if(request.method==='GET'){
  if(file){if(!bucket)return out({error:'Le stockage de fichiers est momentanément indisponible.'},503);const object=await bucket.get(file.object_key);if(!object)return out({error:'Fichier indisponible'},404);return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}
  const rows=await db.prepare(`SELECT id,name,mime,size,created_at FROM business_files WHERE ${rfqId?'rfq_id':'product_id'}=? ORDER BY created_at`).bind(rfqId||productId).all();return out({files:rows.results,available:!!bucket,canUpload:owner&&(rfqId?record.status==='draft'&&['draft','needs_changes'].includes(record.assistance_status):['draft','rejected'].includes(record.status))});
 }
 if(request.method!=='POST')return out({error:'Méthode refusée'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return out({error:'Origine refusée'},403);
 if(!owner)return out({error:'Accès refusé'},403);
 if(rfqId?(record.status!=='draft'||!['draft','needs_changes'].includes(record.assistance_status)):!['draft','rejected'].includes(record.status))return out({error:'Le dossier est déjà partagé ou soumis. Revenez à un brouillon avant de joindre un fichier.'},409);
 if(!bucket)return out({error:'Le dépôt de fichiers n’est pas encore disponible. Votre dossier est conservé sans pièce jointe.'},503);
 if(Number(request.headers.get('content-length')||0)>11*1024*1024)return out({error:'10 Mo maximum par fichier'},413);
 const form=await request.formData(),upload=form.get('file');if(!(upload instanceof File)||!upload.size||upload.size>10*1024*1024||form.get('authorized')!=='yes')return out({error:'Fichier de 10 Mo maximum et autorisation de partage nécessaires'},400);
 const name=upload.name.replace(/[\r\n/\\\x00-\x1f]/g,'_').slice(0,160),ext=name.split('.').pop()?.toLowerCase();
 if(!ext||!['pdf','png','jpg','jpeg','webp','step','stp','dxf'].includes(ext))return out({error:'Formats acceptés : PDF, JPG, PNG, WebP, STEP et DXF.'},400);
 const count=await one(`SELECT COUNT(*) AS n FROM business_files WHERE ${rfqId?'rfq_id':'product_id'}=?`,rfqId||productId);if(Number(count?.n)>=10)return out({error:'10 fichiers maximum par dossier'},400);
 const id=crypto.randomUUID(),key='private/'+id,bytes=await upload.arrayBuffer();await bucket.put(key,bytes);
 try{const inserted=await db.prepare(`INSERT INTO business_files (id,org_id,rfq_id,product_id,name,mime,size,object_key,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM ${rfqId?'rfqs':'business_products'} WHERE id=? AND revision=? AND ${rfqId?"status='draft' AND assistance_status IN ('draft','needs_changes')":"status IN ('draft','rejected')"})`).bind(id,member!.org_id,rfqId||null,productId||null,name,upload.type||'application/octet-stream',String(upload.size),key,new Date().toISOString(),rfqId||productId,record.revision).run();if(inserted.meta.changes!==1){await bucket.delete(key);return out({error:'Le dossier a changé pendant le dépôt. Rechargez avant de partager.'},409)}}catch(e){await bucket.delete(key);throw e}
 return out({id});
 }catch(e){console.error('files_request_failed',e);return out({error:'Fichier indisponible. Le reste du dossier est conservé.'},503)}
}
