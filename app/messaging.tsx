'use client';
import {useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {MessageSquare,Send,ArrowUpRight,RefreshCw,ArrowLeft,Check} from 'lucide-react';
import Link from '@/components/site-link';
import {useLanguage} from './language';
import {countryOptions} from '@/lib/country-names';
type Conversation={id:string;buyer_organization_id:string;supplier_organization_id:string;buyer_name:string;supplier_name:string;product_id:string|null;product_name:string;updated_at:string;unread:number;last_body:string};
type Message={id:string;body:string;sender_organization_id:string;created_at:string};
type Inbox={existingConversation?:string|null;product?:{product_id:string;name:string;supplier_name:string;organization_id:string};supplier?:{organization_id:string;display_name:string};organizations:{id:string;legal_name:string;can_buy:boolean}[];organization:string|null;conversations:Conversation[];moreConversations:boolean;selected:Conversation|null;messages:Message[];moreMessages:boolean};
export default function Messaging(){const query=useSearchParams();return <MessagingInbox key={[query.get('product'),query.get('supplier'),query.get('organization'),query.get('conversation')].join(':')}/>}
function MessagingInbox(){
 const {l,language}=useLanguage(),query=useSearchParams(),product=query.get('product'),supplier=query.get('supplier');
 const [company,setCompany]=useState(query.get('organization')||''),[conversation,setConversation]=useState(query.get('conversation')||''),[page,setPage]=useState(0),[cursor,setCursor]=useState<{date:string;id:string}|null>(null),[tick,setTick]=useState(0),[data,setData]=useState<Inbox|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[sendError,setSendError]=useState(''),[busy,setBusy]=useState(false),[drafts,setDrafts]=useState<Record<string,string>>({}),[companyName,setCompanyName]=useState(''),[country,setCountry]=useState(''),[sent,setSent]=useState(false),[showList,setShowList]=useState(false);
 const retry=useRef<{signature:string;command:string}|null>(null),companyCommand=useRef<{signature:string;command:string}|null>(null),inFlight=useRef(false),bottom=useRef<HTMLDivElement>(null),readIds=useRef(new Set<string>());
 const activeCompany=company||data?.organization||'',draftKey=(activeCompany||'guest')+':'+(conversation||product||supplier||''),body=drafts[draftKey]||'';
 useEffect(()=>{
  const controller=new AbortController();let running=false;
  async function load(){if(running)return;running=true;try{
   const q=new URLSearchParams();if(company)q.set('organization',company);if(product)q.set('product',product);if(supplier)q.set('supplier',supplier);if(conversation)q.set('conversation',conversation);q.set('page',String(page));if(cursor){q.set('before',cursor.date);q.set('beforeId',cursor.id)}
   const r=await fetch('/api/messaging?'+q,{cache:'no-store',signal:controller.signal}),d=await r.json() as Inbox&{error?:string};if(controller.signal.aborted)return;
   if(!r.ok){setError(d.error||'UNAVAILABLE');if([401,403,404].includes(r.status))setData(null);return;}
   setData(d);setError('');if(!conversation&&d.existingConversation){setConversation(d.existingConversation);setCursor(null);setLoading(true);return;}
  }catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError('UNAVAILABLE')}finally{running=false;if(!controller.signal.aborted)setLoading(false)}}
  const refresh=()=>{if(document.visibilityState==='visible')void load()};void load();const timer=setInterval(refresh,4000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[company,product,supplier,conversation,page,cursor,tick]);
 const selected=data?.selected?.id===conversation&&data.organization===activeCompany?data.selected:null;
 const latestMessageId=data?.messages.at(-1)?.id;
 useEffect(()=>{const history=bottom.current?.parentElement;if(!cursor&&history)history.scrollTop=history.scrollHeight},[latestMessageId,conversation,cursor]);
 useEffect(()=>{
  if(showList||!selected||!data)return;const ids=data.messages.map(m=>m.id).filter(id=>!readIds.current.has(id));if(!ids.length)return;
  let cancelled=false;async function mark(){if(document.visibilityState!=='visible')return;try{const r=await fetch('/api/messaging',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:ids})});if(r.ok&&!cancelled){ids.forEach(id=>readIds.current.add(id));window.dispatchEvent(new Event('gsl-messages-changed'));}}catch{/* Next inbox refresh retries the read receipt. */}}
  void mark();document.addEventListener('visibilitychange',mark);return()=>{cancelled=true;document.removeEventListener('visibilitychange',mark)};
 },[data,selected,showList]);
 function open(id:string){if(busy)return;setConversation(id);setCursor(null);setLoading(true);setSendError('');setSent(false);setShowList(false);}
 const targetId=data?.product?.organization_id||data?.supplier?.organization_id,targetName=data?.product?.supplier_name||data?.supplier?.display_name;
 const ownProduct=targetId===activeCompany,needsCompany=!!data&&!data.organizations.length;
 const canCompose=!!data&&!loading&&!error&&(!!selected||(!conversation&&!!targetId&&!ownProduct&&(needsCompany||data.organizations.some(o=>o.id===activeCompany&&o.can_buy))));
 async function send(){
  if(!canCompose||!body.trim()||inFlight.current)return;inFlight.current=true;setBusy(true);setSendError('');setSent(false);let sendingCompany=activeCompany;
  try{
   if(needsCompany){
    const args={name:companyName.trim(),country},signature=JSON.stringify(args);if(companyCommand.current?.signature!==signature)companyCommand.current={signature,command:crypto.randomUUID()};
    const r=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'buyer_company',args,command:companyCommand.current.command})}),d=await r.json() as {error?:string;result:{organizationId:string}};if(!r.ok)throw Error(d.error||'UNAVAILABLE');
    sendingCompany=d.result.organizationId;setDrafts(ds=>({...ds,[sendingCompany+':'+(conversation||product||supplier||'')]:body}));setCompany(sendingCompany);setLoading(true);
   }
   const snapshot={organization:sendingCompany,product:selected?null:product,supplier:selected?null:supplier,conversation:selected?.id||null,body:body.trim()},signature=JSON.stringify(snapshot);
   if(retry.current?.signature!==signature)retry.current={signature,command:crypto.randomUUID()};
   const r=await fetch('/api/messaging',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,command:retry.current.command})}),d=await r.json() as {error?:string;conversation:string};if(!r.ok)throw Error(d.error||'UNAVAILABLE');
   retry.current=null;setDrafts(ds=>({...ds,[draftKey]:'',[sendingCompany+':'+(conversation||product||supplier||'')]:''}));setConversation(d.conversation);setCursor(null);setTick(n=>n+1);setLoading(true);setSent(true);window.dispatchEvent(new Event('gsl-messages-changed'));
  }catch(e){setSendError(e instanceof Error?e.message:'UNAVAILABLE')}finally{setBusy(false);inFlight.current=false}
 }
 const feedback=(code:string)=>code==='RATE_LIMITED'?l('Please wait a minute before sending again.','Patientez une minute avant de réessayer.'):code==='NOT_PUBLISHED'?l('This listing is no longer published. Your existing conversations remain in the inbox.','Cette fiche n’est plus publiée. Vos conversations existantes restent dans la messagerie.'):code==='FORBIDDEN'?l('You no longer have access to this conversation.','Vous n’avez pas accès à cette conversation.'):code==='OWN_PRODUCT'?l('This is your own company. Buyers can contact you from this page.','Il s’agit de votre entreprise. Les acheteurs peuvent vous contacter depuis cette fiche.'):code==='LOGIN_REQUIRED'?l('Sign in to continue.','Connectez-vous pour continuer.'):code==='COMPANY_ALREADY_PRESENT'?l('Your company already exists. Refresh the inbox to use it.','Votre entreprise existe déjà. Actualisez la messagerie pour la retrouver.'):l('Could not connect. Your message has not been cleared; please try again.','Connexion impossible. Votre texte est conservé : vous pouvez réessayer.');
 const returnQuery=new URLSearchParams();for(const key of ['product','supplier','organization','conversation']){const v=query.get(key);if(v)returnQuery.set(key,v)}returnQuery.set('lang',language);const returnTo='/messagerie?'+returnQuery;
 const peer=selected?(selected.buyer_organization_id===activeCompany?selected.supplier_name:selected.buyer_name):targetName,topic=selected?.product_id?selected.product_name:data?.product?.name;
 const linkProduct=selected?selected.product_id:product;
 const hasChat=!!selected||(!conversation&&!!targetId);
 return <main className="inbox-page container">
  <header className="inbox-heading"><div><p className="eyebrow">GSL / {l('MESSAGES','MESSAGERIE')}</p><h1>{l('Your messages','Vos messages')}</h1><p>{l('Contact a manufacturer, ask a question, get a reply.','Contactez un fabricant, posez votre question, échangez simplement.')}</p></div><Link href="/fabricants">{l('Find a manufacturer','Trouver un fabricant')}<ArrowUpRight size={17}/></Link></header>
  {error==='LOGIN_REQUIRED'?<section className="inbox-gate"><MessageSquare size={32}/><h2>{l('Sign in to send your message','Connectez-vous pour envoyer votre message')}</h2><p>{l('Your selected manufacturer or product will be kept.','Le fabricant ou le produit sélectionné sera conservé.')}</p><Link className="button-link" href={'/connexion?next='+encodeURIComponent(returnTo)}>{l('Sign in / create an account','Se connecter / créer un compte')}<ArrowUpRight size={17}/></Link></section>:<>
  {error&&<div className="inbox-alert" role="alert">{feedback(error)} <button onClick={()=>setTick(n=>n+1)}>{l('Retry','Réessayer')}</button></div>}
  {data&&data.organizations.length>1?<label className="inbox-company">{l('Writing as','Vous écrivez au nom de')}<select disabled={busy} value={activeCompany} onChange={e=>{setCompany(e.target.value);setConversation('');setData(null);setPage(0);setCursor(null);setLoading(true);setSendError('');setSent(false)}}>{data.organizations.map(o=><option key={o.id} value={o.id}>{o.legal_name}</option>)}</select></label>:data?.organizations.length===1&&<p className="inbox-identity">{l('Writing as','Vous écrivez au nom de')} <strong>{data.organizations[0].legal_name}</strong></p>}
  <div className={'inbox-layout '+(hasChat&&!showList?'chat-open':'list-open')}><aside className="inbox-list"><div className="inbox-list-head"><strong>{l('Conversations','Conversations')}</strong><button aria-label={l('Refresh inbox','Actualiser la messagerie')} disabled={busy} onClick={()=>setTick(n=>n+1)}><RefreshCw size={16}/></button></div>
   {loading&&!data&&<p role="status">{l('Loading…','Chargement…')}</p>}
   {targetId&&<button className={'inbox-new '+(!conversation?'selected':'')} disabled={busy} onClick={()=>open('')}><span>{l('New message','Nouveau message')}</span><strong>{targetName}</strong><small>{data?.product?.name||l('Direct contact','Contact direct')}</small></button>}
   {data?.conversations.map(c=><button key={c.id} aria-current={conversation===c.id?'true':undefined} className={(conversation===c.id?'selected ':'')+(c.unread?'unread':'')} disabled={busy} onClick={()=>open(c.id)}><strong>{c.buyer_organization_id===activeCompany?c.supplier_name:c.buyer_name}{c.unread>0&&<b className="inbox-unread" aria-label={c.unread+' '+l('unread messages','messages non lus')}>{c.unread}</b>}</strong><span>{c.product_id?c.product_name:l('Direct contact','Contact direct')}</span><span className="inbox-snippet">{c.last_body}</span><small>{new Date(c.updated_at).toLocaleString(language,{dateStyle:'short',timeStyle:'short'})}</small></button>)}
   {data?.conversations.length===0&&<p>{l('Your conversations will appear here after your first message.','Vos conversations apparaîtront ici après votre premier message.')}</p>}
   <div className="inbox-pagination">{page>0&&<button disabled={busy} onClick={()=>setPage(p=>p-1)}>{l('Previous','Précédent')}</button>}{data?.moreConversations&&<button disabled={busy} onClick={()=>setPage(p=>p+1)}>{l('Next','Suivant')}</button>}</div>
  </aside><section className="inbox-chat" aria-busy={loading}>{hasChat?<>
   <header><button className="inbox-back" onClick={()=>setShowList(true)}><ArrowLeft size={16}/>{l('All conversations','Toutes les conversations')}</button><p>{l('Conversation with','Conversation avec')}</p><h2>{peer}</h2>{topic&&<p>{topic}</p>}<Link href={linkProduct?'/produits/'+linkProduct:'/fabricants/'+(selected?.supplier_organization_id||targetId)}>{topic?l('View product','Voir le produit'):l('View company','Voir l’entreprise')}<ArrowUpRight size={14}/></Link></header>
   <div className="inbox-history" role="log" aria-label={l('Messages','Messages')} aria-live="polite">
    {loading&&<p role="status">{l('Updating…','Actualisation…')}</p>}{selected&&data?.moreMessages&&<button className="inbox-history-nav" disabled={busy} onClick={()=>{const first=data.messages[0];if(first){setCursor({date:first.created_at,id:first.id});setLoading(true)}}}><ArrowLeft size={14}/>{l('Older messages','Messages précédents')}</button>}{cursor&&<button className="inbox-history-nav" disabled={busy} onClick={()=>{setCursor(null);setLoading(true)}}>{l('Latest messages','Derniers messages')}</button>}
    {!conversation&&<div className="inbox-welcome"><MessageSquare size={30}/><h3>{l('What would you like to know?','Que souhaitez-vous savoir ?')}</h3><p>{l('Availability, pricing, lead times… Write directly to the manufacturer.','Disponibilité, prix, délais… Écrivez directement au fabricant.')}</p></div>}
    {selected&&data?.messages.map(m=><article key={m.id} className={m.sender_organization_id===activeCompany?'outgoing':'incoming'}><span>{m.sender_organization_id===activeCompany?l('Your company','Votre entreprise'):peer}</span><p>{m.body}</p><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString(language,{dateStyle:'short',timeStyle:'short'})}</time></article>)}<div ref={bottom}/>
   </div>
   {ownProduct&&!conversation?<p className="inbox-alert">{feedback('OWN_PRODUCT')}</p>:<form className="inbox-compose" onSubmit={e=>{e.preventDefault();void send()}}>
    {needsCompany&&<div className="inbox-first-contact"><p>{l('For your first message, tell the manufacturer who you represent. No supplier profile is needed.','Pour ce premier message, indiquez l’entreprise que vous représentez. Aucun dossier fournisseur à remplir.')}</p><label>{l('Company name','Nom de votre entreprise')}<input required minLength={2} maxLength={200} disabled={busy} value={companyName} onChange={e=>setCompanyName(e.target.value)}/></label><label>{l('Country','Pays')}<select required disabled={busy} value={country} onChange={e=>setCountry(e.target.value)}><option value="">{l('Choose','Choisir')}</option>{countryOptions(language).map(c=><option value={c.code} key={c.code}>{c.name}</option>)}</select></label></div>}
    <label htmlFor="message-body">{l('Your message','Votre message')}</label><textarea id="message-body" rows={3} maxLength={10000} disabled={busy||!canCompose} value={body} onChange={e=>{setDrafts(d=>({...d,[draftKey]:e.target.value}));setSent(false)}} placeholder={l('Hello, I would like to know…','Bonjour, je souhaiterais savoir…')} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/>
    <div><span>{l('Ctrl / ⌘ + Enter to send','Ctrl / ⌘ + Entrée pour envoyer')}</span><button className="button-link" disabled={!canCompose||busy||!body.trim()}>{busy?l('Sending…','Envoi…'):l('Send','Envoyer')}<Send size={16}/></button></div>
    {sendError&&<p role="alert" className="inbox-alert">{feedback(sendError)}</p>}{sent&&<p className="inbox-sent" role="status"><Check size={15}/>{l('Message sent','Message envoyé')}</p>}{!needsCompany&&!selected&&!canCompose&&!loading&&!error&&<p>{l('Your role does not allow starting this conversation. Ask your company administrator.','Votre rôle ne permet pas de démarrer cet échange. Contactez l’administrateur de votre entreprise.')}</p>}
    <small>{l('Private conversation · Replies appear automatically','Conversation privée · Les réponses apparaissent automatiquement')}</small>
   </form>}
  </>:<div className="inbox-placeholder"><MessageSquare size={44}/><h2>{loading?l('Loading your messages…','Chargement de vos messages…'):l('Start a conversation','Commencez une conversation')}</h2><p>{l('Choose a conversation, or open a company or product and click “Contact”.','Choisissez une conversation, ou ouvrez une fiche entreprise ou produit et cliquez sur « Contacter ».')}</p><Link className="button-link" href="/fabricants">{l('Find a manufacturer','Trouver un fabricant')} →</Link></div>}</section></div>
  </>}
 </main>;
}
