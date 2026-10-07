import type {AdminExportResource} from './types';
import type {Language} from '@/lib/i18n/languages';

export async function downloadAdminExport(input:{resource:AdminExportResource;language:Language}):Promise<{truncated:boolean}> {
  const response=await fetch('/api/admin/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
  if (!response.ok) {
    const result=await response.json().catch(()=>({error:'UNAVAILABLE'})) as {error?:unknown};
    throw new Error(typeof result.error==='string'?result.error:'UNAVAILABLE');
  }
  if (!response.headers.get('content-type')?.startsWith('text/csv')) throw new Error('UNAVAILABLE');
  const url=URL.createObjectURL(await response.blob());
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`gsl-admin-${input.resource}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
  return {truncated:response.headers.get('x-export-truncated')==='true'};
}
