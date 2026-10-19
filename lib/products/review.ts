import type {SupplierProfile} from '@/lib/onboarding/supplier-profile';
export type SupplierProduct=SupplierProfile['products'][number];
export type ProductReview={id:string;sourceId:string;revision:number;status:'pending'|'approved'|'changes_requested'|'withdrawn';payload:SupplierProduct;productId:string|null;feedback:string;submittedAt:string;companyName?:string;companyCity?:string};
export const productPhotoIds=(raw:unknown):string[]=>{
 try{const value=typeof raw==='string'?JSON.parse(raw):raw;return Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)).slice(0,5):[]}catch{return []}
};
