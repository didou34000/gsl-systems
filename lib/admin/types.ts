import type {AdminPermission, AdminRole} from './permissions';
export type {AdminPermission, AdminRole} from './permissions';

export const adminWidgetIds = ['activity', 'tasks', 'contacts', 'catalog'] as const;
export type AdminWidgetId = (typeof adminWidgetIds)[number];
export type AdminTaskStatus = 'todo' | 'in_progress' | 'done';
export type AdminTaskPriority = 'low' | 'medium' | 'high';

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}
export interface AdminCompany {
  id: string; name: string; country: string; city: string;
  verificationStatus: string; publishedAt: string; withdrawnAt: string | null;
  productCount: number;
}
export interface AdminProduct {
  id: string; companyId: string; companyName: string; name: string;
  category: string; publishedAt: string; withdrawnAt: string | null;
  verificationStatus: string;
}
export interface AdminContact {
  id: string; name: string; email: string; subject: string; body: string;
  language: string; createdAt: string; resolvedAt: string | null;
}
export interface AdminActivity {
  id: string; action: string; resourceId: string; createdAt: string;
}
export interface AdminAccessMember {
  userId: string; email: string; role: AdminRole; grantedAt: string; updatedAt: string;
}
export interface AdminAccessEvent {
  id: string; actorEmail: string; targetEmail: string;
  action: 'access_granted' | 'access_changed' | 'access_revoked';
  previousRole: AdminRole | null; role: AdminRole | null; reason: string; createdAt: string;
}
export interface AdminAccessSnapshot {
  revision: number; members: AdminAccessMember[]; events: AdminAccessEvent[]; truncated: boolean;
}
export const adminExportResources = ['overview', 'companies', 'products', 'contacts', 'activity', 'tasks'] as const;
export type AdminExportResource = (typeof adminExportResources)[number];
export interface AdminExportResult {
  resource: AdminExportResource; rows: Record<string, unknown>[]; generatedAt: string; truncated: boolean; rowLimit: number;
}
export interface AdminSnapshot {
  viewer: {id: string; email: string; reviewer: boolean; role: AdminRole; permissions: AdminPermission[]};
  access: AdminAccessSnapshot | null;
  generatedAt: string;
  stats: {
    users: number; companies: number; publishedCompanies: number;
    products: number; publishedProducts: number; openContacts: number;
    pendingApplications: number; pendingEmails: number; failedEmails: number;
    conversations: number;
  };
  trend: {date: string; companies: number; products: number; contacts: number}[];
  companies: AdminCompany[];
  products: AdminProduct[];
  contacts: AdminContact[];
  activity: AdminActivity[];
  tasks: AdminTask[];
  preferences: {widgetOrder: AdminWidgetId[]};
  revision: number;
  limits: {companies: number; products: number; contacts: number; activity: number};
  totals: {companies: number; products: number; contacts: number; activity: number};
}

export type AdminMutation =
  | {action: 'task.create'; revision: number; id: string; title: string; description: string; status: AdminTaskStatus; priority: AdminTaskPriority; dueDate: string | null}
  | {action: 'task.update'; revision: number; id: string; title: string; description: string; status: AdminTaskStatus; priority: AdminTaskPriority; dueDate: string | null}
  | {action: 'task.delete'; revision: number; id: string}
  | {action: 'tasks.reorder'; revision: number; tasks: {id: string; status: AdminTaskStatus}[]}
  | {action: 'preferences.update'; revision: number; widgetOrder: AdminWidgetId[]}
  | {action: 'contact.resolve'; id: string; resolved: boolean; expectedResolvedAt: string | null}
  | {action: 'access.grant'; email: string; role: AdminRole; reason: string; accessRevision: number}
  | {action: 'access.change'; userId: string; role: AdminRole; reason: string; accessRevision: number}
  | {action: 'access.revoke'; userId: string; reason: string; accessRevision: number};

export type AdminErrorCode = 'LOGIN_REQUIRED' | 'ADMIN_REQUIRED' | 'MFA_REQUIRED' | 'PERMISSION_REQUIRED' | 'SELF_ACCESS_CHANGE' | 'LAST_OWNER' | 'USER_NOT_FOUND' | 'EMAIL_UNCONFIRMED' | 'USER_INACTIVE' | 'ALREADY_GRANTED' | 'INVALID' | 'CONFLICT' | 'NOT_FOUND' | 'LIMIT_REACHED' | 'ORIGIN' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
