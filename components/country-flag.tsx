const flagAssets=['EU','FR','DE','IT','ES','PL','RO','GB','TR','GE','MA','TN','US','CN','RS','MK','BA','MD','AL','EG'];
export default function CountryFlag({code}:{code:string}){
 return flagAssets.includes(code)?<img className="country-flag" src={'/flags/'+code.toLowerCase()+'.svg'} width={24} height={18} alt="" aria-hidden="true"/>:null;
}
