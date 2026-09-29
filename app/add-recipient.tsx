'use client';
import {useState} from 'react';
import RecipientPicker,{type Recipient} from './recipient-picker';
import {useLanguage} from './language';
export default function AddRecipient({request,revision,existing,known,busy,run}:{request:string;revision:number;existing:string[];known:Recipient[];busy:boolean;run:(action:string,args:Record<string,unknown>)=>Promise<void>}){
 const {l}=useLanguage();const [selected,setSelected]=useState<string[]>([]),[suppliers,setSuppliers]=useState(known);
 if(existing.length>=5)return <p>{l('The limit of five recipients has been reached.','La limite de cinq destinataires est atteinte.')}</p>;
 return <details><summary>{l('Send to another supplier','Transmettre à un autre fournisseur')}</summary><p>{l('This company will receive the request already sent and attachments shared with all recipients. Existing private conversations and quotes are not shared.','Cette entreprise recevra la demande déjà transmise et les pièces partagées avec tous les destinataires. Les conversations privées et devis existants ne sont pas partagés.')}</p><RecipientPicker max={1} excluded={existing} known={suppliers} selected={selected} onSelect={setSelected} onDiscover={hits=>setSuppliers(xs=>[...xs,...hits.filter(h=>!xs.some(x=>x.organization_id===h.organization_id))])}/><button disabled={busy||selected.length!==1} onClick={()=>void run('add_recipient',{id:request,revision,supplier:selected[0]})}>{l('Confirm recipient and send','Confirmer le destinataire et transmettre')}</button></details>
}
