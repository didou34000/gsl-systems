import {isSourcingCountry} from '../sourcing-coverage';
import {isRequired,KIND_KEY,normalizeNumber,quantityUnits,specFields,specIssues} from '../products/spec-fields';
import {companyIssues,companyPublicationSchema,productPublicationCategory,productPublicationIssues,publicationCategories,type SupplierProfile} from './supplier-profile';

const percentage=(checks:boolean[],valid:boolean)=>{
 if(!checks.length)return 0;
 const value=Math.floor(100*checks.filter(Boolean).length/checks.length);
 // Never show a fully ready profile while the publication validator still rejects it.
 return value===100&&!valid?99:value;
};

/** Optional sections and navigation do not count as completed required information. */
export function supplierProgress(profile:SupplierProfile,view:'company'|'products'):number{
 if(view==='company'){
  const checks=[
   profile.legalName.trim().length>=2,
   isSourcingCountry(profile.country),
   Boolean(profile.headquarters.city.trim()),
   Boolean(profile.activity),
   profile.description.trim().length>=30,
   Boolean(profile.contact.name.trim()),
   /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.contact.email.trim()),
   profile.attestation,
  ];
  return percentage(checks,companyIssues(profile).length===0&&companyPublicationSchema.safeParse(profile).success);
 }
 const products=profile.products.filter(p=>p.listingStatus!=='draft');
 if(!products.length)return 0;
 const checks:boolean[]=[profile.attestation];
 for(const product of products){
  const technical=specIssues(product.family,product.specs);
  const quantity=normalizeNumber(product.moq);
  checks.push(
   Boolean(product.name.trim()),
   Boolean(product.family)&&!technical.some(issue=>issue.code==='FAMILY'),
   publicationCategories.includes(productPublicationCategory(product)),
   product.description.trim().length>=30,
   isSourcingCountry(product.origin),
   /^\d+(\.\d+)?$/.test(quantity)&&Number(quantity)>0,
   (quantityUnits as readonly string[]).includes(product.unit),
  );
  for(const field of specFields(product.family,product.specs?.[KIND_KEY]||'').filter(field=>isRequired(field,product.specs?.[KIND_KEY]||''))){
   checks.push(!technical.some(issue=>issue.key===field.key));
  }
 }
 return percentage(checks,productPublicationIssues(profile).length===0);
}
