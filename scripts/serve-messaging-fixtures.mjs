// Browser UI fixtures only: synthetic accounts and messages, no remote services.
// PostgreSQL permissions and delivery are verified separately by test-product-messaging.mjs.
import http from 'node:http';
import {randomUUID} from 'node:crypto';
if(process.env.DATABASE_URL||process.env.SUPABASE_URL)throw Error('External database refused');
const buyer='11111111-1111-4111-8111-111111111111',supplier='22222222-2222-4222-8222-222222222222',product='33333333-3333-4333-8333-333333333333';
const conversations=[],messages=[],reads=new Map(),commands=new Map();let fail=false,newCompany=false;
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
for(const port of [5188,5189,5190,5191])http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost:'+port),seller=port===5189,guest=port===5190,newbie=port===5191,company=seller?supplier:buyer,identity=String(port);
 if(url.pathname==='/fixture'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(`<h1>Local synthetic ${seller?'manufacturer':guest?'guest':newbie?'new buyer':'buyer'}</h1><a href='/messagerie?supplier=${supplier}&lang=fr'>Contacter l’entreprise</a><p><a href='/messagerie?product=${product}&lang=fr'>Contacter depuis le produit</a></p><a href='/messagerie?lang=fr'>Ouvrir la messagerie</a><form method='post' action='/fixture-fail'><button>Simuler une panne du prochain envoi</button></form>`)}
 if(url.pathname==='/fixture-fail'){fail=true;res.writeHead(303,{Location:'/fixture'});return res.end()}
 if(url.pathname.startsWith('/api/')){
  if(guest)return json(res,{error:'LOGIN_REQUIRED'},401);
  let body={};if(['POST','PATCH'].includes(req.method)){let raw='';for await(const chunk of req)raw+=chunk;body=JSON.parse(raw)}
  if(url.pathname==='/api/workspace')return json(res,{user:{name:'Test local',email:'test@example.invalid'},favorites:[],drafts:[]});
  if(url.pathname==='/api/auth')return json(res,{user:{name:'Test local',email:'test@example.invalid',confirmed:true,language:'fr'}});
  if(url.pathname==='/api/platform'&&req.method==='POST'){newCompany=true;return json(res,{result:{organizationId:buyer}})}
  if(url.pathname==='/api/messaging'){
   const seen=reads.get(identity)||new Set();reads.set(identity,seen);
   const unread=m=>m.sender_organization_id!==company&&!seen.has(m.id);
   if(req.method==='PATCH'){body.messages.forEach(id=>seen.add(id));return json(res,{ok:true})}
   if(req.method==='POST'){
    if(fail){fail=false;return json(res,{error:'UNAVAILABLE'},503)}
    if(commands.has(body.command))return json(res,commands.get(body.command));
    let c=conversations.find(c=>c.id===body.conversation)||conversations.find(c=>c.product_id===body.product);
    if(!c){c={id:randomUUID(),buyer_organization_id:buyer,supplier_organization_id:supplier,buyer_name:'Acheteur local',supplier_name:'Atelier local',product_id:body.product,product_name:body.product?'Pièce usinée':'Contact direct'};conversations.push(c)}
    const m={id:randomUUID(),conversation_id:c.id,body:body.body,sender_organization_id:company,created_at:new Date().toISOString()};messages.push(m);c.updated_at=m.created_at;
    const result={conversation:c.id,message:m.id};commands.set(body.command,result);return json(res,result);
   }
   if(url.searchParams.get('unread'))return json(res,{unread:messages.filter(unread).length});
   const conversation=url.searchParams.get('conversation'),selected=conversations.find(c=>c.id===conversation)||null,requestedProduct=url.searchParams.get('product'),requestedSupplier=url.searchParams.get('supplier');
   const rows=conversations.map(c=>({...c,unread:messages.filter(m=>m.conversation_id===c.id&&unread(m)).length,last_body:messages.filter(m=>m.conversation_id===c.id).at(-1)?.body||''}));
   return json(res,{organizations:newbie&&!newCompany?[]:[{id:company,legal_name:seller?'Atelier local':'Acheteur local',can_buy:true}],organization:newbie&&!newCompany?null:company,conversations:rows,selected,messages:messages.filter(m=>m.conversation_id===conversation),moreMessages:false,moreConversations:false,product:requestedProduct&&!conversation?{product_id:product,name:'Pièce usinée',supplier_name:'Atelier local',organization_id:supplier}:null,supplier:requestedSupplier&&!conversation?{organization_id:supplier,display_name:'Atelier local'}:null,existingConversation:!conversation&&(requestedProduct||requestedSupplier)?conversations.find(c=>c.product_id===(requestedProduct?product:null))?.id:null});
  }
  return json(res,{error:'Unknown fixture'},404);
 }
 const upstream=http.request({hostname:'127.0.0.1',port:5173,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:'+port}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});upstream.on('error',()=>{res.writeHead(502);res.end('Start Next on port 5173')});req.pipe(upstream);
}catch(e){json(res,{error:e.message},500)}}).listen(port,'127.0.0.1',()=>console.log('Local synthetic messaging: http://127.0.0.1:'+port+'/fixture'));
