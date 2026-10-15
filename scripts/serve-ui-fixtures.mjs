// Local UI contract fixtures only. No production credentials, external database or emails.
import http from 'node:http';
import fs from 'node:fs';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
if(process.env.SUPABASE_URL||process.env.DATABASE_URL)throw Error('External database refused');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const encoded=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const iso=encoded(compile('lib/onboarding/iso-countries.ts'));
const coverage=encoded(compile('lib/sourcing-coverage.ts'));
const countries=encoded(compile('lib/onboarding/country-requirements.ts'));
const options=encoded(compile('lib/onboarding/country-options.ts').replaceAll("'./iso-countries'",JSON.stringify(iso)).replace("'../sourcing-coverage'",JSON.stringify(coverage)));
const code=compile('lib/onboarding/supplier-profile.ts').replaceAll("'./iso-countries'",JSON.stringify(iso)).replace("'../sourcing-coverage'",JSON.stringify(coverage)).replace("'./country-requirements'",JSON.stringify(countries)).replace("'./country-options'",JSON.stringify(options)).replace("'../products/spec-fields'",JSON.stringify(encoded(compile('lib/products/spec-fields.ts')))).replace("'zod'",JSON.stringify(pathToFileURL(process.cwd()+'/node_modules/zod/index.js').href));
const {emptyProfile,supplierDraftSchema,supplierSchema,productPublicationIssues,companyIssues,profileIssues,supplierValidationIssues}=await import(encoded(code));
const org=randomUUID(),product=randomUUID(),user=randomUUID();
let favorites=[product];let buyerCompany=null;let requests=[];let profile=emptyProfile();
Object.assign(profile,{legalName:'Atelier de test local',country:'TR',legalForm:'Ltd',activity:'manufacturer',description:'Entreprise de test isolée pour vérifier le parcours de création.',identifiers:{mersis:'TEST',trade_registry_number:'TEST',trade_registry_office:'TEST'},headquarters:{line:'Adresse de test',city:'Bursa',country:'',postalCode:'',region:''}});
profile.capabilities={...profile.capabilities,processes:'CNC',materials:'Aluminium',quality:'Contrôle dimensionnel'};
profile.contact={...profile.contact,name:'Contact test',role:'Commercial',email:'test@example.invalid',languages:'Français'};profile.trade.markets='France';
profile.certificates=[{id:randomUUID(),scope:'management',name:'Certificat commencé',issuer:'',number:'',coveredScope:'',issued:'',expires:'',notifiedBody:'',verificationUrl:'https://',documentId:'',productId:''}];
profile.sites=[{id:randomUUID(),name:'Atelier',address:{...profile.headquarters,country:'TR'},relationship:'owned',area:'500'}];
let publication={organization_id:org,public_details:{verification:'unverified'}};let publishedProducts=0;
let application={payload:profile,revision:1,status:'draft',updated_at:new Date().toISOString(),reviewer_notes:''};
const companyImages=new Map();
const files=[{id:randomUUID(),kind:'registration',name:'justificatif-test.pdf',size:100,caption:'Document synthétique local'}];
function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost:5188');const guest=url.searchParams.get('fixture')==='guest'||req.headers.cookie?.includes('gsl-fixture-guest=1');
 // fixture=newbuyer: a confirmed account without any company, to check the purchasing-company onboarding.
 const newBuyer=url.searchParams.has('fixture')?url.searchParams.get('fixture')==='newbuyer':!!req.headers.cookie?.includes('gsl-fixture-newbuyer=1');
 if(url.searchParams.has('fixture')){res.setHeader('Set-Cookie',['gsl-fixture-guest='+(url.searchParams.get('fixture')==='guest'?'1':'0')+'; Path=/; SameSite=Lax','gsl-fixture-newbuyer='+(newBuyer?'1':'0')+'; Path=/; SameSite=Lax']);if(newBuyer)buyerCompany=null}
 const ownOrganizations=newBuyer?(buyerCompany?[buyerCompany]:[]):[{id:org,legal_name:'Atelier de test local',country_code:'TR',buyer:true,supplier:true}];
 if(url.pathname.startsWith('/api/')){
  if(url.pathname==='/api/home-catalogue')return json(res,{products:[{product_id:product,organization_id:org,name:'Pièce usinée de test',category:'metal',description:'Produit synthétique local pour vérifier la nouvelle présentation du catalogue.',specifications:{manufacturing_country:'TR',minimum_quantity:'50',unit:'pcs'},manufacturer:{organization_id:org,display_name:'Atelier de test local',country_code:'TR'}}],suppliers:[{organization_id:org,display_name:'Atelier de test local',country_code:'TR',city:'Bursa',description:'Fabricant synthétique pour vérification locale uniquement.'}]});
  if(url.pathname==='/api/platform'&&url.searchParams.get('view')==='catalogue')return json(res,{suppliers:[],count:0,page:1});
  if(guest)return json(res,{error:'LOGIN_REQUIRED'},401);
  if(url.pathname==='/api/company-images'){
   if(req.method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);const form=await new Request('http://localhost/image',{method:'POST',headers:{'content-type':req.headers['content-type']},body:Buffer.concat(chunks)}).formData();const file=form.get('file');const id=randomUUID();companyImages.set(id,{bytes:Buffer.from(await file.arrayBuffer()),type:file.type});return json(res,{id})}
   const file=companyImages.get(url.searchParams.get('id'));if(!file)return json(res,{},404);res.writeHead(200,{'Content-Type':file.type});return res.end(file.bytes);
  }
  if(url.pathname==='/api/supplier-profile/files'){
   if(req.method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);const form=await new Request('http://localhost/upload',{method:'POST',headers:{'content-type':req.headers['content-type']},body:Buffer.concat(chunks)}).formData();const file=form.get('file');files.push({id:randomUUID(),kind:form.get('kind'),name:file.name,size:file.size,caption:form.get('caption')});return json(res,{ok:true})}
   res.writeHead(200,{'Content-Type':'application/pdf'});return res.end('%PDF-1.4\nSynthetic local test document');
  }
  let body={};if(req.method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);body=JSON.parse(Buffer.concat(chunks).toString())}
  if(url.pathname==='/api/auth')return json(res,{user:{name:'Compte de test',email:'test@example.invalid',confirmed:true,language:'fr'}});
  if(url.pathname==='/api/supplier-profile'){
   if(req.method==='POST'){
    if(body.revision!==application.revision)return json(res,{error:'CONFLICT'},409);
    const parsed=(body.action==='submit'?supplierSchema:supplierDraftSchema).safeParse(body.profile);
    if(!parsed.success)return json(res,{error:'INVALID',issues:supplierValidationIssues(body.profile)},400);
    const issues=body.action==='publish_products'?productPublicationIssues(parsed.data):body.action==='publish'?companyIssues(parsed.data):profileIssues(parsed.data,files);if(['submit','publish','publish_products'].includes(body.action)&&issues.length)return json(res,{error:'INCOMPLETE',issues},422);
    await new Promise(r=>setTimeout(r,180));profile=parsed.data;application={...application,payload:profile,revision:application.revision+1,status:body.action==='submit'?'submitted':'draft',updated_at:new Date().toISOString()};if(body.action==='publish_products')publishedProducts=profile.products.filter(p=>p.listingStatus!=='draft').length;if(body.action==='publish')publication={organization_id:org};return json(res,{application});
   }if(newBuyer)return json(res,{application:null,publication:null,publishedProducts:0,files:[],events:[],pendingUploads:[],email:'test@example.invalid'});return json(res,{application,publication,publishedProducts,files,events:[],pendingUploads:[],email:'test@example.invalid'});
  }
  if(url.pathname==='/api/member')return json(res,{user:{name:'Compte de test',email:'test@example.invalid'},favorites:favorites.length,requests,conversations:[],organizations:ownOrganizations,application:newBuyer?null:{name:profile.legalName,status:application.status,products:profile.products.length}});
  if(url.pathname==='/api/workspace'){if(req.method==='POST'){favorites=body.selected?[...new Set([...favorites,body.productId])]:favorites.filter(x=>x!==body.productId);return json(res,{ok:true})}return json(res,{user:{name:'Compte de test',email:'test@example.invalid'},favorites,drafts:[]})}
  if(url.pathname==='/api/platform'){
   if(url.searchParams.get('view')==='selection')return json(res,{products:favorites.map(id=>({product_id:id,organization_id:org,name:'Pièce de test locale',description:'Référence synthétique pour vérification des favoris.'}))});
   if(req.method==='POST'&&body.action==='buyer_company'){buyerCompany={id:randomUUID(),legal_name:String(body.args.name),country_code:String(body.args.country),buyer:true,supplier:false};return json(res,{ok:true,result:{organizationId:buyerCompany.id}})}
   if(req.method==='POST'&&body.action==='save_rfq'){const r={...body.args,id:randomUUID(),revision:1,state:'draft',organization_id:org};requests.push(r);return json(res,{result:r,ok:true})}
   return json(res,{currentUser:{id:user},organizations:ownOrganizations,members:[{user_id:user,organization_id:org,active:true,role:'owner'}],rfqs:requests,threads:[],offers:[],invitations:[],pagination:{page:0,total:requests.length,hasMore:false}});
  }
  if(url.pathname==='/api/messaging')return json(res,{organizations:[{id:org,legal_name:'Atelier de test local',can_buy:true}],replyOrganizations:[{id:org,legal_name:'Atelier de test local',can_buy:true}],organization:org,conversations:[],messages:[],selected:null,moreMessages:false,moreConversations:false});
  return json(res,{error:'Fixture route not implemented'},404);
 }
 const upstream=http.request({hostname:'127.0.0.1',port:5173,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:5188'}},r=>{const own=res.getHeader('Set-Cookie');const headers={...r.headers};if(own)headers['set-cookie']=[...[].concat(own),...[].concat(r.headers['set-cookie']||[])];res.removeHeader('Set-Cookie');res.writeHead(r.statusCode,headers);r.pipe(res)});upstream.on('error',()=>{res.writeHead(502);res.end('Start Next on port 5173 first')});req.pipe(upstream);
}catch(e){json(res,{error:String(e.message)},500)}}).listen(5188,'127.0.0.1',()=>console.log('Isolated UI fixtures: http://127.0.0.1:5188 (not production end-to-end verification)'));
