/** Private account label only: never changes company records, permissions or public profiles. */
type Organization={id:string;legal_name:string;trading_name?:string|null;buyer:boolean;supplier:boolean};
type Application={organization_id:string|null;payload:unknown}|null;
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
export function workspaceIdentity(organizations:Organization[],application:Application){
 const company=organizations.find(o=>o.id===application?.organization_id)||organizations.find(o=>o.supplier)||organizations[0];
 const saved=application?.payload&&typeof application.payload==='object'?application.payload as Record<string,unknown>:{};
 const savedName=text(saved.legalName)||text(saved.tradingName);
 // A linked profile names that organization. An unlinked draft may label a single-company
 // account, but must not relabel an unrelated company in a multi-company workspace.
 const applies=application&&(application.organization_id?application.organization_id===company?.id:organizations.length<=1);
 const companyName=company?text(company.legal_name)||text(company.trading_name):'';
 return {
  company:company?{name:companyName,buyer:organizations.some(o=>o.buyer),supplier:organizations.some(o=>o.supplier)}:null,
  companyLabel:applies&&savedName?savedName:companyName,
 };
}
