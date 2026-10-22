import axiosClient from './axiosClient';
import { API_ENDPOINTS } from '../../config/constants';
import type { Lead, Customer, Campaign } from '../../types';

export const crmService = {
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

  getCustomers: (page: number = 0, size: number = 50): Promise<any> =>
    axiosClient.get(API_ENDPOINTS.CUSTOMERS, { params: { page, size } }),
  getCustomerById: (id: string | number): Promise<Customer> =>
    axiosClient.get(`${API_ENDPOINTS.CUSTOMERS}/${id}`),
  createCustomer: (customerData: Partial<Customer>): Promise<Customer> =>
    axiosClient.post(API_ENDPOINTS.CUSTOMERS, customerData),
  updateCustomer: (id: string | number, customerData: Partial<Customer>): Promise<Customer> =>
    axiosClient.put(`${API_ENDPOINTS.CUSTOMERS}/${id}`, customerData),
  deleteCustomer: (id: string | number): Promise<any> =>
    axiosClient.delete(`${API_ENDPOINTS.CUSTOMERS}/${id}`),

  getCampaigns: (page: number = 0, size: number = 50): Promise<any> =>
    axiosClient.get(API_ENDPOINTS.CAMPAIGNS, { params: { page, size } }),
  createCampaign: (campaignData: Partial<Campaign>): Promise<Campaign> =>
    axiosClient.post(API_ENDPOINTS.CAMPAIGNS, campaignData),
  getAdSets: (page: number = 0, size: number = 50): Promise<any> =>
    axiosClient.get(API_ENDPOINTS.AD_SETS, { params: { page, size } }),
  getAds: (page: number = 0, size: number = 50): Promise<any> =>
    axiosClient.get(API_ENDPOINTS.ADS, { params: { page, size } }),

  getLeadForms: (): Promise<any> => axiosClient.get(API_ENDPOINTS.LEAD_FORMS),
  getLeadPreferences: (): Promise<any> => axiosClient.get(API_ENDPOINTS.LEAD_PREFERENCES),
};

export default crmService;
