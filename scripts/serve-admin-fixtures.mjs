// Isolated visual/interaction fixture. Never imported by the application or deployed.
// All records are fictional, all mutations are confined to this process.
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText).toString('base64');
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const {rolePermissions}=await import(moduleUrl(await read('lib/admin/permissions.ts')));
const csvUrl=moduleUrl(await read('lib/admin/csv.ts'));
const translationUrl=moduleUrl(await read('lib/admin/translations.ts'));
const accessTranslationUrl=moduleUrl(await read('lib/admin/access-translations.ts'));
const {adminExportCsv}=await import(moduleUrl((await read('lib/admin/export.ts')).replace("from './csv'",`from '${csvUrl}'`).replace("from './translations'",`from '${translationUrl}'`).replace("from './access-translations'",`from '${accessTranslationUrl}'`)));
if (process.env.SUPABASE_URL || process.env.DATABASE_URL) throw Error('External database refused');
const now = new Date().toISOString();
const companies = [
  {id:randomUUID(),name:'Atelier Atlas · test',country:'MA',city:'Casablanca',verificationStatus:'unverified',publishedAt:now,withdrawnAt:null,productCount:2},
  {id:randomUUID(),name:'Bursa Precision · test',country:'TR',city:'Bursa',verificationStatus:'documents_reviewed',publishedAt:now,withdrawnAt:null,productCount:1},
  {id:randomUUID(),name:'Tunis Assemblage · test',country:'TN',city:'Tunis',verificationStatus:'unverified',publishedAt:now,withdrawnAt:now,productCount:0},
];
const state = {
  viewer:{id:randomUUID(),email:'admin@example.invalid',reviewer:false},generatedAt:now,
  stats:{users:8,companies:3,publishedCompanies:2,products:3,publishedProducts:3,openContacts:2,pendingApplications:1,pendingEmails:0,failedEmails:0,conversations:4},
  trend:Array.from({length:30},(_,i)=>({date:new Date(Date.now()-(29-i)*86400000).toISOString().slice(0,10),companies:i%9===0?1:0,products:i%7===0?1:0,contacts:i%13===0?1:0})),
  companies,products:['Bride aluminium · test','Boîtier technique · test','Pièce tournée · test'].map((name,i)=>({id:randomUUID(),companyId:companies[i%2].id,companyName:companies[i%2].name,name,category:'metal',publishedAt:now,withdrawnAt:null,verificationStatus:'unverified'})),
  contacts:[{id:randomUUID(),name:'Camille · test',email:'camille@example.invalid',subject:'Question sur le catalogue',body:'Message fictif local pour vérifier le traitement d’une demande.',language:'fr',createdAt:now,resolvedAt:null},{id:randomUUID(),name:'Alex · test',email:'alex@example.invalid',subject:'Présentation de notre atelier',body:'Deuxième demande synthétique. Aucun message externe ne sera envoyé.',language:'en',createdAt:now,resolvedAt:null}],
  activity:[],tasks:[{id:randomUUID(),title:'Examiner le dossier Atlas · test',description:'Tâche synthétique locale',status:'todo',priority:'high',dueDate:null,position:0,createdAt:now,updatedAt:now},{id:randomUUID(),title:'Relire le catalogue · test',description:'',status:'in_progress',priority:'medium',dueDate:null,position:1,createdAt:now,updatedAt:now},{id:randomUUID(),title:'Préparer la semaine · test',description:'',status:'done',priority:'low',dueDate:null,position:2,createdAt:now,updatedAt:now}],
  preferences:{widgetOrder:['activity','tasks','contacts','catalog']},revision:0,
  limits:{companies:1000,products:1000,contacts:500,activity:100},totals:{companies:3,products:3,contacts:2,activity:0}
};
const accounts=Object.keys(rolePermissions).map(role=>({userId:randomUUID(),email:role+'@example.invalid',role,grantedAt:now,updatedAt:now}));
const newAccount={userId:randomUUID(),email:'invitee@example.invalid'};
const access={revision:0,members:structuredClone(accounts),events:[],truncated:false};
const workspaces=new Map(accounts.map(account=>[account.userId,{tasks:state.tasks.map(task=>({...task,id:randomUUID()})),preferences:structuredClone(state.preferences),revision:0}]));
function snapshot(account,gate){
 const member=access.members.find(item=>item.userId===account.userId);
 const permissions=rolePermissions[member.role];
 const permittedContacts=permissions.includes('contacts.read');
 return {...state,...workspaces.get(account.userId),viewer:{id:account.userId,email:account.email,reviewer:false,role:member.role,permissions},access:permissions.includes('access.manage')?access:null,
  contacts:permittedContacts?state.contacts:[],activity:state.activity.filter(event=>!event.ownerId||event.ownerId===account.userId).filter(event=>permittedContacts||!event.action.startsWith('contact')),
  totals:{...state.totals,contacts:permittedContacts?state.contacts.length:0},generatedAt:new Date().toISOString(),
  ...(gate==='empty'?{companies:[],products:[],tasks:[],contacts:[],activity:[],trend:[],stats:Object.fromEntries(Object.keys(state.stats).map(k=>[k,0])),totals:{companies:0,products:0,contacts:0,activity:0}}:{})};
}
const reply=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost:5189');
  if(url.searchParams.has('fixture'))res.setHeader('Set-Cookie','gsl-admin-fixture='+encodeURIComponent(url.searchParams.get('fixture'))+'; Path=/; SameSite=Lax');
  if(url.pathname.startsWith('/api/')){
    const gate=req.headers.cookie?.match(/gsl-admin-fixture=([^;]+)/)?.[1];
    if(url.pathname==='/api/workspace')return reply(res,{user:{name:'Local fixture',email:'admin@example.invalid'},favorites:[],drafts:[]});
    if(url.pathname==='/api/admin'||url.pathname==='/api/admin/export'){
      if(['guest','denied','mfa','error'].includes(gate))return reply(res,{error:{guest:'LOGIN_REQUIRED',denied:'ADMIN_REQUIRED',mfa:'MFA_REQUIRED',error:'UNAVAILABLE'}[gate]},gate==='guest'?401:gate==='error'?503:403);
      const account=accounts.find(item=>item.role===gate)||accounts.find(item=>item.role==='owner');
      const member=access.members.find(item=>item.userId===account.userId);
      if(!member)return reply(res,{error:'ADMIN_REQUIRED'},403);
      const permissions=rolePermissions[member.role],workspace=workspaces.get(account.userId);
      if(req.method==='POST'){
        const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks));
        if(url.pathname==='/api/admin/export'){
          if(!permissions.includes('data.export'))return reply(res,{error:'PERMISSION_REQUIRED'},403);
          const data=snapshot(account,gate);
          const rows=body.resource==='overview'?Object.entries(data.stats).map(([name,value])=>({name,value})):data[body.resource];
          if(!Array.isArray(rows))return reply(res,{error:'INVALID'},400);
          state.activity.unshift({id:randomUUID(),action:'data_exported_'+body.resource,resourceId:account.userId,ownerId:account.userId,createdAt:new Date().toISOString()});
          res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Cache-Control':'no-store','Content-Disposition':'attachment; filename="gsl-admin-'+body.resource+'.csv"','X-Export-Truncated':'false'});
          return res.end(adminExportCsv({resource:body.resource,rows,truncated:false,rowLimit:5000,generatedAt:now},body.language));
        }
        if(body.action?.startsWith('access.')){
          if(!permissions.includes('access.manage'))return reply(res,{error:'PERMISSION_REQUIRED'},403);
          if(body.accessRevision!==access.revision)return reply(res,{error:'CONFLICT'},409);
          if(!body.reason||body.reason.trim().length<10||body.reason.length>500)return reply(res,{error:'INVALID'},400);
          const target=body.action==='access.grant'?[...accounts,newAccount].find(item=>item.email===body.email.trim().toLowerCase()):[...accounts,newAccount].find(item=>item.userId===body.userId);
          if(!target)return reply(res,{error:'USER_NOT_FOUND'},404);
          if(target.userId===account.userId)return reply(res,{error:'SELF_ACCESS_CHANGE'},403);
          const previous=access.members.find(item=>item.userId===target.userId);
          if(body.action==='access.grant'&&previous)return reply(res,{error:'ALREADY_GRANTED'},409);
          if(body.action!=='access.grant'&&!previous)return reply(res,{error:'NOT_FOUND'},404);
          if(body.action!=='access.revoke'&&!rolePermissions[body.role])return reply(res,{error:'INVALID'},400);
          access.members=access.members.filter(item=>item.userId!==target.userId);
          if(body.action!=='access.revoke')access.members.push({userId:target.userId,email:target.email,role:body.role,grantedAt:previous?.grantedAt||new Date().toISOString(),updatedAt:new Date().toISOString()});
          access.events.unshift({id:randomUUID(),actorEmail:account.email,targetEmail:target.email,action:{'access.grant':'access_granted','access.change':'access_changed','access.revoke':'access_revoked'}[body.action],previousRole:previous?.role||null,role:body.action==='access.revoke'?null:body.role,reason:body.reason,createdAt:new Date().toISOString()});
          access.revision++;
          return reply(res,snapshot(account,gate));
        }
        if((body.action?.startsWith('task')&&!permissions.includes('tasks.manage'))||(body.action==='contact.resolve'&&!permissions.includes('contacts.manage')))return reply(res,{error:'PERMISSION_REQUIRED'},403);
        if(body.action!=='contact.resolve'&&body.revision!==workspace.revision)return reply(res,{error:'CONFLICT'},409);
        if(body.action==='task.create')workspace.tasks.push({id:body.id,title:body.title,description:body.description,status:body.status,priority:body.priority,dueDate:body.dueDate,position:workspace.tasks.length,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
        else if(body.action==='task.update'){const task=workspace.tasks.find(t=>t.id===body.id);if(!task)return reply(res,{error:'NOT_FOUND'},404);for(const key of ['title','description','status','priority','dueDate'])task[key]=body[key];task.updatedAt=new Date().toISOString();}
        else if(body.action==='task.delete')workspace.tasks=workspace.tasks.filter(t=>t.id!==body.id);
        else if(body.action==='tasks.reorder')body.tasks.forEach((item,i)=>{const task=workspace.tasks.find(t=>t.id===item.id);if(task){task.status=item.status;task.position=i;}});
        else if(body.action==='preferences.update')workspace.preferences.widgetOrder=body.widgetOrder;
        else if(body.action==='contact.resolve'){const contact=state.contacts.find(c=>c.id===body.id);if(!contact)return reply(res,{error:'NOT_FOUND'},404);if(contact.resolvedAt!==body.expectedResolvedAt)return reply(res,{error:'CONFLICT'},409);contact.resolvedAt=body.resolved?new Date().toISOString():null;state.stats.openContacts=state.contacts.filter(c=>!c.resolvedAt).length;}
        else return reply(res,{error:'INVALID'},400);
        workspace.revision++;state.activity.unshift({id:randomUUID(),action:body.action==='contact.resolve'?(body.resolved?'contact_resolved':'contact_reopened'):body.action.replace('.','_'),ownerId:body.action==='contact.resolve'?null:account.userId,resourceId:body.id||account.userId,createdAt:new Date().toISOString()});state.totals.activity=state.activity.length;
      }
      return reply(res,snapshot(account,gate));
    }
    return reply(res,{error:'Fixture route not implemented'},404);
  }
  const upstream=http.request({hostname:'127.0.0.1',port:5173,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:5189'}},r=>{const headers={...r.headers};if(url.searchParams.has('fixture'))headers['set-cookie']=[...(headers['set-cookie']||[]),'gsl-admin-fixture='+encodeURIComponent(url.searchParams.get('fixture'))+'; Path=/; SameSite=Lax'];res.writeHead(r.statusCode,headers);r.pipe(res)});
  upstream.on('error',()=>{res.writeHead(502);res.end('Start Next on 5173');});req.pipe(upstream);
}catch(error){reply(res,{error:String(error.message)},500);}}).listen(5189,'127.0.0.1',()=>console.log('Local fictional admin fixtures: http://127.0.0.1:5189/administration?lang=fr'));
