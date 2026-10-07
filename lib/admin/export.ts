import {adminCsv} from './csv';
import {adminTranslate, type AdminKey} from './translations';
import {accessTranslate} from './access-translations';
import type {AdminExportResource, AdminExportResult} from './types';
import type {Language} from '@/lib/i18n/languages';

// Explicit columns prevent a future database field from silently appearing in an export.
const columns: Record<AdminExportResource, {field: string; label: AdminKey}[]> = {
  overview: [{field:'name',label:'name'},{field:'value',label:'results'}],
  companies: [{field:'id',label:'entity'},{field:'name',label:'name'},{field:'country',label:'country'},{field:'verificationStatus',label:'reviewStatus'},{field:'publishedAt',label:'published'},{field:'withdrawnAt',label:'suspended'},{field:'productCount',label:'productCount'}],
  products: [{field:'id',label:'entity'},{field:'name',label:'name'},{field:'companyName',label:'companies'},{field:'verificationStatus',label:'reviewStatus'},{field:'publishedAt',label:'published'},{field:'withdrawnAt',label:'suspended'}],
  contacts: [{field:'id',label:'entity'},{field:'name',label:'name'},{field:'email',label:'email'},{field:'subject',label:'subject'},{field:'body',label:'message'},{field:'language',label:'language'},{field:'createdAt',label:'received'},{field:'resolvedAt',label:'resolved'}],
  activity: [{field:'action',label:'event'},{field:'resourceId',label:'entity'},{field:'createdAt',label:'date'}],
  tasks: [{field:'title',label:'title'},{field:'description',label:'taskNotes'},{field:'status',label:'status'},{field:'priority',label:'priority'},{field:'dueDate',label:'dueDate'}],
};

export function adminExportCsv(result: AdminExportResult, language: Language): string {
  const selected = columns[result.resource];
  const metricLabels:Record<string,string>={
    users:accessTranslate(language,'metricUsers'),companies:adminTranslate(language,'totalCompanies'),
    publishedCompanies:accessTranslate(language,'metricPublishedCompanies'),products:adminTranslate(language,'products'),
    publishedProducts:adminTranslate(language,'publishedProducts'),openContacts:adminTranslate(language,'openContacts'),
    pendingApplications:adminTranslate(language,'pendingReviews'),pendingEmails:adminTranslate(language,'pendingEmails'),
    failedEmails:adminTranslate(language,'emailFailures'),conversations:accessTranslate(language,'metricConversations'),
  };
  return adminCsv([
    selected.map(column => adminTranslate(language, column.label)),
    ...result.rows.map(row => selected.map(column => {
      const value = row[column.field];
      if(result.resource==='overview'&&column.field==='name'&&typeof value==='string')return metricLabels[value]||value;
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : '';
    })),
  ]);
}
