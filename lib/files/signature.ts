export function fileMime(bytes:Uint8Array){
 if(bytes.slice(0,5).toString()==='37,80,68,70,45')return 'application/pdf';
 if(bytes.slice(0,8).toString()==='137,80,78,71,13,10,26,10')return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export const safeFilename=(name:string)=>name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100)||'document';
