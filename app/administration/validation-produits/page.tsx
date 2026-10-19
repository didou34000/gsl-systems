import {AdminFrame} from '@/app/admin-shell';
import AdminProductReviews from '@/app/admin-product-reviews';
export const metadata={robots:{index:false,follow:false}};
export default function Page(){return <AdminFrame current="product-review"><AdminProductReviews/></AdminFrame>}
