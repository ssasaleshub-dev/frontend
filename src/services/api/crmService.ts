import axiosClient from './axiosClient';
import { API_ENDPOINTS } from '../../config/constants';
import type { Lead, Customer } from '../../types';

/**
 * The backend LeadPreference entity still uses column names inherited from the original
 * project template. Until the backend renames them, CRM concepts map to those columns here and
 * ONLY here. Keys are CRM field names; values are the backend column names.
 */
export const LEAD_PREFERENCE_LEGACY_FIELDS = {
  paymentStatus: 'mattressType',
  paymentDetails: 'mattressSize',
  closingDate: 'purchaseTimeline',
} as const;

type LegacyMappedField = keyof typeof LEAD_PREFERENCE_LEGACY_FIELDS;

/** Converts CRM-named preference fields into the backend's column names. */
export function toLeadPreferencePayload(fields: Record<string, any>): Record<string, any> {
  const payload: Record<string, any> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined) return;
    const legacyKey = LEAD_PREFERENCE_LEGACY_FIELDS[key as LegacyMappedField];
    payload[legacyKey || key] = value;
  });
  return payload;
}

/** Reads a CRM field from a lead, falling back to the backend's legacy column name. */
export function readLeadPreferenceField(lead: Record<string, any> | null | undefined, field: LegacyMappedField): any {
  if (!lead) return undefined;
  return lead[field] ?? lead[LEAD_PREFERENCE_LEGACY_FIELDS[field]];
}

export const crmService = {
  /**
   * Updates the lead's preference record, or creates one if the lead has none yet.
   * `fields` use CRM names (paymentStatus, paymentDetails, closingDate, budgetRange, ...).
   * Throws on failure so callers can surface the error.
   */
  upsertLeadPreference: (lead: Lead, fields: Record<string, any>): Promise<any> => {
    const payload = toLeadPreferencePayload(fields);
    const prefId = (lead as any).preferenceId || (lead as any).leadPreferenceId;
    if (prefId) {
      payload.id = Number(prefId);
      return axiosClient.patch(`${API_ENDPOINTS.LEAD_PREFERENCES}/${prefId}`, payload);
    }
    payload.lead = { id: lead.id };
    return axiosClient.post(API_ENDPOINTS.LEAD_PREFERENCES, payload);
  },

  getLeadAnalytics: (visaType?: string): Promise<any> => {
    const params = visaType && visaType !== 'ALL' ? { visaType } : undefined;
    return axiosClient.get(API_ENDPOINTS.LEADS_ANALYTICS, params ? { params } : undefined);
  },

  getDetailedLeads: (visaType?: string): Promise<Lead[]> => {
    const params = visaType && visaType !== 'ALL' ? { visaType } : undefined;
    return axiosClient.get(API_ENDPOINTS.LEADS_DETAILED, params ? { params } : undefined);
  },
  getDetailedLeadById: (id: string | number): Promise<Lead> =>
    axiosClient.get(`${API_ENDPOINTS.LEADS_DETAILED}/${id}`),

  assignLead: (id: string | number, assignedTo: string): Promise<any> =>
    axiosClient.patch(`/api/leads/${id}/assign`, { assignedTo }),

  updateLeadStatus: (id: string | number, status: string, notes?: string): Promise<any> =>
    axiosClient.patch(`/api/leads/${id}/status`, { status, notes }),

  getLeads: (page: number = 0, size: number = 50, sort: string = 'id,desc'): Promise<any> =>
    axiosClient.get(API_ENDPOINTS.LEADS, { params: { page, size, sort } }),
  getLeadById: (id: string | number): Promise<Lead> =>
    axiosClient.get(`${API_ENDPOINTS.LEADS}/${id}`),
  createLead: (leadData: Partial<Lead>): Promise<Lead> =>
    axiosClient.post(API_ENDPOINTS.LEADS, leadData),
  updateLead: (id: string | number, leadData: Partial<Lead>): Promise<Lead> =>
    axiosClient.put(`${API_ENDPOINTS.LEADS}/${id}`, leadData),
  patchLead: (id: string | number, leadData: Partial<Lead>): Promise<Lead> =>
    axiosClient.patch(`${API_ENDPOINTS.LEADS}/${id}`, leadData),
  deleteLead: (id: string | number): Promise<any> =>
    axiosClient.delete(`${API_ENDPOINTS.LEADS}/${id}`),

  importLeadsFile: (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(API_ENDPOINTS.LEADS_IMPORT_FILE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importRawLeads: (rawData: string): Promise<any> =>
    axiosClient.post(API_ENDPOINTS.LEADS_IMPORT_RAW, rawData, {
      headers: { 'Content-Type': 'text/plain' },
    }),
  seedSampleLeads: (): Promise<any> => axiosClient.post(API_ENDPOINTS.LEADS_IMPORT_SAMPLE),

  getCustomers: (
    page: number = 0,
    size: number = 25,
    paged: boolean = true,
    sort: string = 'id,desc'
  ): Promise<any> =>
    axiosClient.get(API_ENDPOINTS.CUSTOMERS, {
      params: { page, size, paged, sort },
    }),
  getCustomerById: (id: string | number): Promise<Customer> =>
    axiosClient.get(`${API_ENDPOINTS.CUSTOMERS}/${id}`),
  createCustomer: (customerData: Partial<Customer>): Promise<Customer> =>
    axiosClient.post(API_ENDPOINTS.CUSTOMERS, customerData),
  updateCustomer: (id: string | number, customerData: Partial<Customer>): Promise<Customer> =>
    axiosClient.put(`${API_ENDPOINTS.CUSTOMERS}/${id}`, customerData),
  deleteCustomer: (id: string | number): Promise<any> =>
    axiosClient.delete(`${API_ENDPOINTS.CUSTOMERS}/${id}`),

  getLeadForms: (): Promise<any> => axiosClient.get(API_ENDPOINTS.LEAD_FORMS),
  getLeadPreferences: (): Promise<any> => axiosClient.get(API_ENDPOINTS.LEAD_PREFERENCES),
  createLeadPreference: (prefData: any): Promise<any> =>
    axiosClient.post(API_ENDPOINTS.LEAD_PREFERENCES, prefData),
  updateLeadPreference: (id: string | number, prefData: any): Promise<any> =>
    axiosClient.put(`${API_ENDPOINTS.LEAD_PREFERENCES}/${id}`, prefData),
};

export default crmService;
