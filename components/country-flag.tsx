import {availableCountries} from '@/lib/onboarding/country-options';
export default function CountryFlag({code}:{code:string}){
 return availableCountries.includes(code)?<img className="country-flag" src={'/flags/'+code.toLowerCase()+'.svg'} width={24} height={18} alt="" aria-hidden="true"/>:null;
}
