import type {CompanyResearch} from '@/lib/catalogue-research';

/** This snapshot is only returned by the owner/AAL2-gated catalogue RPC. */
export type CatalogueCompany = {
  id: string;
  name: string;
  country: string;
  city: string;
  description: string;
  processes: string[];
  materials: string[];
  website: string | null;
  details: Record<string, unknown>;
  revision: number;
  published: boolean;
};

export type CatalogueProduct = {
  id: string;
  companyId: string;
  name: string;
  reference: string;
  category: string;
  description: string;
  specifications: Record<string, string>;
  revision: number;
  published: boolean;
};

export type CatalogueSnapshot = {
  companies: CatalogueCompany[];
  products: CatalogueProduct[];
  recipients: {userId: string; name: string; email: string}[];
  notificationStatus: {pending: number; failed: number};
  canManage: true;
  /** Configuration presence only; delivery is reported separately by the worker. */
  emailConfigured: boolean;
};

export type CatalogueMutation =
  | {
      action: 'save_company'; id: string; revision: number;
      name: string; country: string; city: string; description: string;
      processes: string[]; materials: string[]; website: string | null;
      research: CompanyResearch;
    }
  | {
      action: 'save_product'; id: string; revision: number;
      name: string; reference: string; category: string; description: string;
      specifications: Record<string, string>;
    }
  | {action: 'set_company_visibility'; id: string; revision: number; published: boolean}
  | {action: 'set_product_visibility'; id: string; revision: number; published: boolean};

export type CatalogueMutationResult = {saved: true; revision: number};
export type CatalogueErrorCode =
  | 'LOGIN_REQUIRED' | 'ADMIN_REQUIRED' | 'OWNER_REQUIRED' | 'PERMISSION_REQUIRED'
  | 'MFA_REQUIRED' | 'EMAIL_UNCONFIRMED' | 'USER_INACTIVE'
  | 'INVALID' | 'ORIGIN' | 'CONFLICT' | 'NOT_FOUND' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
