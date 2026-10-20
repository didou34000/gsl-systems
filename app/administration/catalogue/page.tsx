import AdminCatalogue from '@/app/admin-catalogue';
import {AdminFrame} from '@/app/admin-shell';
import '@/app/admin-catalogue.css';

export const metadata = {
  title: 'GSL systems, Administration du catalogue',
  robots: {index: false, follow: false},
};

export default function CatalogueAdministrationPage() {
  return <AdminFrame current="catalogue"><AdminCatalogue /></AdminFrame>;
}
